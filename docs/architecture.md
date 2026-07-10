# Architecture

Speedora is an AI video repurposing platform (OpusClip-style): upload a long video, auto-detect
viral-worthy moments, crop/caption them, publish. See [`../CLAUDE.md`](../CLAUDE.md) for the
product summary and doc index; see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for the JSON-contract
stateless-module pattern used by every AI analysis module.

## Monorepo layout

```
apps/
  web/        # Next.js frontend — upload UI, editor, dashboard, OCR review
  api/        # NestJS backend — REST API, auth, job orchestration
  worker/     # BullMQ job consumer — ASR, clip detection, FFmpeg render, AI analysis
packages/
  shared/             # Cross-app TypeScript types, DTOs, constants, utils
  database/           # Prisma schema/client (Postgres), used by api + worker
  storage/            # S3-compatible object storage client
  social/             # OAuth clients, token encryption, per-platform upload/stats clients
  contracts/           # Zod schemas + inferred types for every stateless module's I/O
  clip-scoring, cutlist, subtitles, reframe, emoji-suggester,
  audio-intelligence, scene-intelligence, facial-intelligence,
  gesture-intelligence, ocr-intelligence, editing-rhythm,
  fusion-engine        # Stateless JSON-in/JSON-out analysis modules (see coding-standards.md)
```

`apps/web` and `apps/api` only talk over HTTP — no direct imports between them. `apps/worker` has
no HTTP server; it only consumes BullMQ jobs enqueued by `apps/api` (and, for self-chained
pipeline stages, by itself). Types shared across apps live once in `packages/shared`.

## Core pipeline (MVP)

```
Upload → Transcript (ASR) → Auto-clip detection → Caption + Reframe render → Download
```

1. **Upload** — `apps/web` uploads to `apps/api`; video goes to object storage, a `Video` row is
   created with status `UPLOADED` (or `IMPORTING` first, for a YouTube URL import — see
   `worker.md`).
2. **Transcript** — `apps/api` enqueues `transcribe`. `apps/worker` runs Whisper (Groq by default,
   OpenAI for paid premium — see `ai/llm.md` / `backend.md`), persists `TranscriptSegment` rows,
   status → `TRANSCRIBED`.
3. **Auto-clip** — `transcribe`'s success self-chains `detect-clips` (worker enqueues this itself,
   not the API). One LLM call scores/selects 1–3 candidate clips from the transcript
   (`packages/clip-scoring`, see `ai/llm.md`). Status → `CLIPS_DETECTED`.
4. **Caption + Reframe** — `detect-clips`'s success self-chains one `render-clip` job per
   candidate. `render-clip` does face detection/reframe, burns in captions, runs every AI
   Intelligence module (scene/audio/facial/gesture/OCR/camera-motion/editing-rhythm), computes the
   Fusion Engine `highlightScore`, uploads the rendered file. `Video.status` → `RENDERED` only once
   **every** sibling clip has finished rendering.
5. **Download** — `apps/web` polls `GET /videos/:id` every 2s until `RENDERED`/`FAILED`.
6. **Retry** — `POST /videos/:id/retry` infers which stage to redo from what data already exists
   (no separate "failed at" marker) — see `database.md`.

Each stage is a separate BullMQ job (not one monolithic job) so retries are granular per stage and
the FFmpeg render cluster can scale independently of ASR.

## State machine + audit trail

`Video.status` is a linear enum: `IMPORTING → UPLOADED → TRANSCRIBED → CLIPS_DETECTED → RENDERED`,
with `FAILED` reachable from any stage. Every transition is written through
`@speedora/database`'s `updateVideoStatus()`/`recordVideoStatusEvent()` — the **only** sanctioned
way to change `Video.status` — which atomically inserts a `VideoStatusEvent` row (`toStatus`,
`errorMessage` for `FAILED`, `createdAt`) alongside the update. No `fromStatus` column: transitions
for one video are always sequential, so the previous status is just the prior event row. This is
pure observability infrastructure, not a JSON-contract module — it's meant to be the one place
other modules are told to avoid (direct DB writes).

Two real-time progress columns exist on top of the coarse state machine, both written as real
checkpoints (never a fabricated/interpolated animation) and reset to `0`/`null` at the start of
every attempt including retries:

- `Video.transcribeProgress` (0–100) — checkpoints inside the Transcribe stage (source downloaded,
  each Whisper chunk done).
- `Video.importProgress` (0–100) — real yt-dlp download percentage during a YouTube import,
  parsed from `--progress-template` output streamed via `spawn` (not buffered `execFile`).

`apps/web`'s `ProcessingStatus` component additionally layers a **"creep" animation** (+1%/sec
toward the current stage's ceiling between real checkpoints, never crossing a stage boundary until
the backend actually reports it) so long waits don't read as a dead screen — a deliberate,
documented exception to the "no fabricated animation" rule for the raw progress *values* (the
checkpoints themselves are still always real).

## Job queue design

See `queue.md` for the full BullMQ picture. Key points: `apps/worker` self-chains pipeline stages
(no round-trip through `apps/api`), job payloads are minimal (IDs only — workers re-fetch current
state from Postgres rather than trusting enqueue-time snapshots), and PostgreSQL — not Redis — is
the source of truth for all durable state. Redis/BullMQ is queue + cache only.

## Storage

Video bytes live in an S3-compatible bucket (`packages/storage`), never on shared disk — `apps/api`
and `apps/worker` are separate processes/containers. `Video.sourceUrl`/`Clip.outputUrl` store the
**object key**, not a path or public URL. Clients never talk to the bucket directly except one
documented exception (Instagram's Content Publishing API, which requires a public `video_url` —
`packages/storage`'s `getPresignedDownloadUrl()`, a short-lived signed URL, see `ai/../backend.md`'s
Publish Center section). Everything else streams through `apps/api` (`GET /videos/:id/source`,
`GET /clips/:id/stream`, `GET /clips/:id/download`), with HTTP Range support for scrubbing/seeking
in `<video>` elements. See `docker.md` for local (MinIO) vs. production (R2/S3) storage endpoints.

## Auth

Email + password + JWT in an httpOnly cookie (not `localStorage`/`Authorization` header) — see
`backend.md`. `ownerId` for any video/clip is always taken from the session user, never from the
request body. `GET /videos/:id` and `GET /clips/:id/download` return an identical 404 for
"not found" and "belongs to another user" so IDs can't be enumerated.

## JSON-contract stateless module pattern

Every AI analysis capability (clip scoring, cutlist, subtitles, reframe, audio/scene/facial/
gesture/OCR intelligence, editing rhythm, the Fusion Engine) follows one architectural pattern,
formalized in [`../ARCHITECTURE.md`](../ARCHITECTURE.md):

- Input/output schemas live in `packages/contracts` as Zod schemas with inferred TS types.
- The module itself (`packages/<name>`) is pure JSON-in/JSON-out — no Prisma, no BullMQ, no
  `process.env`, no `__dirname`. Anything deployment/environment-specific (subprocess paths, API
  clients, model file locations) is injected via a `deps` parameter, never read internally.
- A thin **adapter** inside `apps/worker` (usually inline in the relevant `*.worker.ts`) narrows
  the DB row shape to the module's input contract, calls the module, and persists the result. This
  is the *only* place that's allowed to know both the module's contract and Prisma's schema.
- DB is still the source of truth/hand-off medium between pipeline stages (unlike a literal
  file-based JSON pipeline) — see `ai/fusion.md`'s gap-analysis note on this distinction.

This is why the codebase has ~15 tiny `packages/*` modules instead of one large `apps/worker/src`
tree: each new AI signal (audio, scene, facial, gesture, OCR, camera motion, editing rhythm, the
fusion engine itself) gets its own package, independently testable with plain fixtures and no
mocks.

## Multi-modal AI Fusion signal flow

```
Video → { Audio, Scene, Facial, Gesture, OCR, LLM } analysis modules
      → Fusion Engine (weighted, feature-level, per-clip)
      → highlightScore + confidence + explainability + prediction + recommendation
```

See `ai/fusion.md` for the full picture — this is the architecture's most actively evolving area.

## Docker builds

Each app has its own multi-stage `Dockerfile`, built from the repo root (workspace deps need
`packages/*`). See `docker.md` and `deployment.md` for the full build/deploy story, including
`apps/worker`'s Python/MediaPipe/Tesseract/OpenCV dependencies and the local-dev-vs-production
object storage split (MinIO vs. R2).
