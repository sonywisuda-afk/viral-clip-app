# Backend (`apps/api`)

NestJS REST API. Never runs Whisper/FFmpeg synchronously in a request — all heavy work is
delegated to `apps/worker` via BullMQ. See `architecture.md` for the overall pipeline and
`queue.md` for job orchestration.

## Modules

- **Auth** (`src/auth`) — email + password + JWT in an httpOnly cookie. `POST /auth/register`
  (bcrypt hash, auto-login), `POST /auth/login` (rate-limited: 5 attempts/60s/IP via
  `@nestjs/throttler`, `ThrottlerGuard` applied only to this route, in-memory not Redis-backed),
  `POST /auth/logout`, `GET /auth/me`. `JwtStrategy` reads the `token` cookie, not an
  `Authorization` header.
- **Videos** (`src/videos`) — upload, YouTube import, status polling, transcript, source
  streaming, retry.
- **Clips** (`src/clips`) — trim/caption-style updates, render trigger, publish, download/stream,
  delete.
- **Social** (`src/social`) — OAuth connect/refresh/disconnect for YouTube/TikTok/Instagram.
- **Payments** (`src/payments`) — Midtrans Snap checkout + webhook for premium (OpenAI) Whisper
  credits.

## Ownership & security

`ownerId` for a video is always taken from `@CurrentUser()` (the JWT session), never from the
request body — there is no "create/act as any user by email" endpoint. `GET /videos/:id` and
`GET /clips/:id/download` return an identical 404 whether the resource doesn't exist or belongs to
another user, so IDs can't be probed. CORS is enabled explicitly with `credentials: true`
(`WEB_ORIGIN`) so the browser can send the session cookie cross-origin to a different port in dev.

## Boot-time guarantees

- `helmet()` is applied (CSP, HSTS, X-Frame-Options, etc.).
- `GET /health` (no auth, no rate limit) runs `SELECT 1` against Postgres, returns 503 if
  unreachable — for load balancers/orchestrators.
- Required env vars (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `STORAGE_*`) are validated
  synchronously at boot (`src/config/env.validation.ts`, via `ConfigModule.forRoot({ validate })`)
  — a missing required var fails fast at startup, not deep inside a request handler. Vars with a
  safe code default (`WEB_ORIGIN`, `API_PORT`, `JWT_EXPIRES_IN`) are not required. Optional
  integrations (`SENTRY_DSN`, `GOOGLE_OAUTH_CLIENT_ID`, `TOKEN_ENCRYPTION_KEY`,
  `MIDTRANS_SERVER_KEY`) are validated as optional — the rest of the app boots and works normally
  without them; only the feature that needs them 503s with a clear message when actually called.
- `SentryExceptionFilter` (`@Catch()` global, extends `BaseExceptionFilter`) reports only
  unexpected exceptions (non-`HttpException`, or `HttpException` with status ≥ 500) — normal
  control flow (`NotFoundException`, `BadRequestException`) is not reported. Only the exception
  object is sent to Sentry, never the request/response (which could carry a session cookie/JWT).
  Constructed with `app.get(HttpAdapterHost).httpAdapter` (the real adapter), not the
  `HttpAdapterHost` wrapper — `BaseExceptionFilter` calls methods directly on whatever it's given.

## Key endpoints

- `GET /videos`, `GET /videos/:id` (polled every 2s by the frontend while processing), `GET
  /videos/:id/transcript` (separate from `findOne` so the 2s poll doesn't drag transcript text
  along), `GET /videos/:id/source` (Range-enabled stream of the *source*, not rendered, video —
  used by the Timeline Editor's `<video>` preview), `POST /videos`, `POST /videos/import-youtube`,
  `POST /videos/:id/retry`, `DELETE /videos/:id`.
- `PATCH /clips/:id` (trim/caption-style, no auto-render), `POST /clips/:id/render` (explicit
  re-render, clears `outputUrl` before enqueue), `GET /clips/:id/download` (attachment,
  `Content-Disposition`), `GET /clips/:id/stream` (Range-enabled inline playback — added because
  `:id/download`'s attachment header + lack of Range support meant the dashboard's `<video>`
  preview could never actually play), `POST /clips/:id/publish` (optional `scheduledAt`),
  `DELETE`/`PATCH /clips/:id/publish/:recordId` (cancel/reschedule, `SCHEDULED` only).
- `GET /social/accounts`, `GET /social/:platform/connect` (top-level `<a href>` navigation, not
  `fetch` — OAuth needs a real browser redirect), `GET /social/:platform/callback` (no
  `JwtAuthGuard` — trusts a signed short-lived `state` JWT instead of the session cookie, which may
  have expired mid-redirect).
- `POST /payments/premium-transcription/checkout`, `POST /payments/webhook/midtrans` (no
  `JwtAuthGuard` — server-to-server, trusted via HMAC signature + `crypto.timingSafeEqual`, not a
  session).

## Publish Center

`SocialAccount` (per-platform OAuth tokens, AES-256-GCM encrypted at the app level via
`TOKEN_ENCRYPTION_KEY`, portable across hosting providers) and `PublishRecord` (one row per publish
*attempt* — `QUEUED → PUBLISHING → PUBLISHED/FAILED`, or `SCHEDULED` first if `scheduledAt` is in
the future). Publishing itself runs in `apps/worker`'s `publish-clip` job (see `worker.md`);
`ClipsService.publish()` just creates the `PublishRecord` row and enqueues.

- **YouTube** — `google-auth-library`/`googleapis`, default `privacyStatus: 'unlisted'`. Title from
  `Clip.hookText`, description from `Clip.hashtags`.
- **TikTok** — "Upload to Inbox" (draft), not Direct Post — avoids the App Review gate for direct
  public posting. UI explicitly says "Sent to TikTok — open the app to finish posting", never
  "Published". Hand-rolled `fetch()` calls (no official Node SDK exists).
- **Instagram Reels** — Facebook Login + a linked Instagram Business/Creator account (not the newer
  Instagram Login flow). Video is handed to Meta via a **presigned URL** (`getPresignedDownloadUrl`,
  15-minute TTL) — Instagram's Content Publishing API has no byte-upload option, only "fetch from a
  public URL". This is the one place the app exposes anything resembling a direct bucket link.
  Container-create → poll status → publish (two API calls with async processing in between, unlike
  YouTube's one-shot `videos.insert`).
- **Scheduling** — a BullMQ *repeatable* job (`schedule-publish-clip.worker.ts`, polls Postgres
  every 60s) claims `SCHEDULED` rows atomically via `updateMany({ where: { status: SCHEDULED } })`
  and only enqueues `publish-clip` if exactly one row was updated — not a Redis delayed job, so
  losing Redis state only delays the next poll, never silently drops a scheduled publish.
- **Analytics** — `sync-publish-stats` (repeatable, every 6h) refreshes
  `viewCount`/`likeCount`/`commentCount` snapshots (overwritten, not time-series) per platform via
  dedicated `*-stats.client.ts` files in `packages/social`.

## Premium transcription payment gate

`PremiumCredit` (one row per Midtrans transaction, `PENDING/PAID/FAILED/EXPIRED`, `videoId`
nullable+unique — non-null means "consumed"). `POST /videos`/`/import-youtube` reject an
`OPENAI` provider request with 400 unless an unconsumed `PAID` credit exists, claimed atomically
(`updateMany` guarded on `videoId: null`); a race that loses the claim rolls back the just-created
video row (and its uploaded object, if any) rather than leaving it dangling without a credit. The
Midtrans webhook (HMAC-verified, idempotent via `updateMany` guarded on `status: PENDING`) is the
only source of truth for payment status — the client-side Snap.js callback only triggers a status
poll, never a trusted state change.
