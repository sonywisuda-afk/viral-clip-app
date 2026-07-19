# Platform Capability Matrix

This app supports 8 platforms (`SocialPlatform` enum: `YOUTUBE`, `TIKTOK`, `INSTAGRAM`, `FACEBOOK`,
`THREADS`, `LINKEDIN`, `PINTEREST`, `X`), and no two of them expose the same set of capabilities
through their public APIs. Rather than let "does platform X support Y" be answered ad hoc at each
call site, this app keeps that answer in exactly two explicit registries — one per capability axis
— so "not available" is always a looked-up, explained fact, never a silent gap or a guess.

## Two separate capability axes

These are genuinely different questions and this app tracks them in two different files. Don't
conflate them:

1. **Can we publish TO this platform, and how?** — `apps/worker/src/publish/platform-registry.ts`,
   the `platformRegistry: Record<SocialPlatform, PlatformPublishAdapter>` map.
2. **Can we read metrics BACK from this platform?** — `packages/analytics-report/src/aggregation/
   platform-capability.util.ts`, the `PLATFORM_CAPABILITY: Record<SocialPlatform, PlatformCapability>`
   table.

A platform can be fully publishable but only partially readable (every platform in this app is, in
fact, exactly that — see the table below).

## Axis 1 — Publish capability (`platform-registry.ts`)

Every platform implements the required `publish()` method (a `PublishRecord` cannot exist for a
platform that can't be posted to). `syncStats?`/`fetchFollowerCount?` are **optional** on the
`PlatformPublishAdapter` interface — their absence, not a runtime failure, is how
`sync-publish-stats.worker.ts`/`sync-follower-count.worker.ts` know to skip a platform entirely,
filtering on `typeof adapter.syncStats === 'function'` rather than maintaining a second hand-copied
platform list.

| Platform | Publish mechanism | `syncStats` | `fetchFollowerCount` |
|---|---|:---:|:---:|
| YouTube | One-shot `videos.insert` upload (byte stream), default `privacyStatus: 'unlisted'` | ✅ | ✅ |
| TikTok | "Upload to Inbox" (draft) — not Direct Post, avoids the App Review gate for direct public posting; UI says "Sent to TikTok — open the app to finish posting," never "Published" | ✅ (two-step; can be `pending` while the user hasn't finished posting from their TikTok app) | ✅ (needs the `user.info.stats` scope — see `needs-reconnect` below) |
| Instagram | Presigned URL (`getPresignedDownloadUrl`, 15-min TTL) → container-create → poll status → publish, since Instagram's Content Publishing API has no byte-upload option, only "fetch from a public URL" | ✅ | ✅ |
| Facebook | Same presigned-URL, fetch-from-URL model as Instagram, via the Video Reels API's upload-session handoff | ✅ | ✅ |
| Threads | Same presigned-URL container-create/publish model as Instagram | ✅ | ❌ absent — no public API exposes a Threads follower count |
| LinkedIn | Real byte upload via LinkedIn's own fixed 4MiB-part multi-part upload (not fetch-from-URL like the Meta platforms) | ✅ | ❌ absent — no public LinkedIn API exposes personal-profile connection/follower counts |
| Pinterest | Byte upload; **mandates a cover image** — fails loudly with a specific error if the clip's AI-selected thumbnail isn't extracted yet, rather than letting Pinterest's API 400 | ✅ | ✅ |
| X | Byte upload; explicitly documented as a "best-effort platform" — a billing/quota failure surfaces as a normal thrown error, same honest-`FAILED`-status path as any other publish failure, no special-casing | ✅ | ✅ |

See `docs/backend.md`'s Publish Center section for the fuller narrative on YouTube/TikTok/Instagram
specifically (OAuth flow shape, scheduling, the `sync-publish-stats` job cadence) — this table's
publish-mechanism column is the one-line version for all 8, including the 5 platforms
(Facebook/Threads/LinkedIn/Pinterest/X, the "Multi-Platform Publishing Expansion") that
`docs/backend.md` doesn't narrate individually.

## Axis 2 — Read/analytics capability (`platform-capability.util.ts`)

The real source of truth, reproduced verbatim below (not paraphrased — the exact reasons are the
point of this table). Every "not available" answer has a `reason`; some `available` cells still
carry a `note` caveat about what the number actually means.

Legend: ✅ available · 🔄 needs-reconnect (data exists on the platform, but this app doesn't hold
the OAuth scope yet for accounts connected before that scope was added — the UI should offer a
reconnect action, not a flat "never available" message) · ❌ unavailable (the platform's API
genuinely doesn't expose this, for any account)

| Platform | Views | Likes | Comments | Shares | Watch time | Follower count |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| YouTube | ✅ | ✅ | ✅ | ❌ *(a)* | ❌ *(b)* | ✅ |
| TikTok | ✅ | ✅ | ✅ | ✅ | ❌ *(c)* | 🔄 *(d)* |
| Instagram | ✅ *("plays")* | ✅ | ✅ | ✅ | ✅ *(e)* | ✅ |
| Facebook | ✅ | ✅ | ✅ | ❌ *(f)* | ❌ *(f)* | ✅ |
| Threads | ✅ | ✅ | ✅ *("replies")* | ✅ *("reposts")* | ❌ *(g)* | ❌ *(h)* |
| LinkedIn | ❌ *(i)* | ✅ | ✅ | ❌ *(j)* | ❌ *(k)* | ❌ *(l)* |
| Pinterest | ✅ *("impressions")* | ✅ *("saves" — no true "like")* | ❌ *(m)* | ❌ *(n)* | ❌ *(o)* | ✅ |
| X | ✅ *(`impression_count`)* | ✅ | ✅ *(`reply_count`)* | ✅ *(`retweet_count`)* | ❌ *(p)* | ✅ |

Reasons, verbatim from the source:

- *(a)* "YouTube's Data API doesn't expose a shares count for videos."
- *(b)* "Requires the YouTube Analytics API (a separate OAuth scope this app does not request
  today)."
- *(c)* "TikTok's public API has no endpoint exposing watch time or retention for any video — a
  hard platform limitation, not a gap in this app."
- *(d)* "Reconnect your TikTok account to grant the follower-count permission." (the
  `user.info.stats` scope)
- *(e)* Available, but *"a single average-watch-time value per post, not a second-by-second
  retention curve"* — reachable under the already-granted `instagram_manage_insights` scope.
- *(f)*, shares and watch time both: "Not returned by / not exposed by the Graph API endpoints
  this app's scopes allow."
- *(g)* "Not exposed by the Threads Graph API."
- *(h)* "The Threads Graph API doesn't expose a follower-count field today."
- *(i)* "LinkedIn's API doesn't return a view count for this content type."
- *(j)* "Not returned by the scopes this app requests."
- *(k)* "LinkedIn has no video-watch-time API."
- *(l)* "No public LinkedIn API exposes personal-profile connection/follower counts."
- *(m)* "Pinterest's API doesn't expose a comment count for Pins."
- *(n)* "Not exposed by Pinterest's API."
- *(o)* "Not applicable — Pinterest Pins aren't a watch-time format."
- *(p)* "Not exposed by the X API tier this app uses."

`getMetricCapability(platform, metric)` / `isMetricAvailable(platform, metric)` are the two
lookup functions every "not available" UI reads from — see `docs/frontend.md`'s `UnavailableMetric`
component and `docs/ai/dataset-feedback-loop.md` for how this same honesty rule extends into the
Fusion Engine's training-data pipeline (`PublishRecordStatsSnapshot`/
`SocialAccountFollowerSnapshot` simply have no row, rather than a fabricated one, for a metric this
table marks unavailable).

## Cross-check: the two axes agree

`fetchFollowerCount` is present on the `platformRegistry` adapter for every platform *except*
Threads and LinkedIn — exactly the two platforms `PLATFORM_CAPABILITY` marks `followerCount:
unavailable` for. This isn't a coincidence to maintain by hand; it's worth keeping true by
construction (see the checklist below) rather than letting the two registries silently drift.

## A third, adjacent registry (not a capability axis)

`packages/shared/src/types/social.ts` also holds `PLATFORM_METADATA` (display label/icon
key/brand color — the frontend's `PLATFORM_LABELS` in `apps/web/lib/analytics.ts` is derived from
this, not hand-copied) and `BEST_TIME_HEURISTICS` (a static, non-personalized best-time-to-post
heuristic per platform, Publishing Expansion Phase 7A — explicitly generic industry-standard
guessing, not data-driven, since production has 0 usable per-platform engagement samples to
personalize from yet). Neither of these answers "is X available" — they're display/heuristic data
— but a new platform needs entries in both to render correctly and to get a best-time suggestion.

## Adding a new platform — checklist

Only steps verified as real requirements by reading the code above, not a guessed list:

1. Add the platform to the `SocialPlatform` enum (`packages/database/prisma/schema.prisma`) and
   run a migration.
2. Add an OAuth client in `packages/social/src/<platform>-oauth.client.ts`, following an existing
   one's shape (`buildAuthorizeUrl`/`exchangeCode`/`fetchProfile`) — wired into
   `SocialController`'s `oauthRegistry` (`apps/api/src/social/social.controller.ts`).
3. Register a `PlatformPublishAdapter` entry in `platformRegistry`
   (`apps/worker/src/publish/platform-registry.ts`) — `publish()` is required; add `syncStats`/
   `fetchFollowerCount` only if the platform's API genuinely supports them (their *absence* is the
   signal the sync jobs read, so don't stub a function that always throws or returns a fake value).
4. Add a `PlatformCapability` entry to `PLATFORM_CAPABILITY`
   (`packages/analytics-report/src/aggregation/platform-capability.util.ts`) covering **every**
   `MetricKey` (`views`/`likes`/`comments`/`shares`/`watchTime`/`followerCount`), even the ones that
   are `unavailable` — this table is keyed by the full enum and a missing entry is a type error, by
   design, so this can't be forgotten silently. Verify it agrees with step 3's
   `fetchFollowerCount` presence (see the cross-check above) rather than letting the two drift.
5. Add a `PLATFORM_METADATA` entry (`packages/shared/src/types/social.ts`) — label, icon key, brand
   color hex.
6. Add a `BEST_TIME_HEURISTICS` entry in the same file if the new platform should get a
   best-time-to-post suggestion (Publishing Expansion Phase 7A) — optional, but every existing
   platform has one.
7. Write the platform's `*-stats.client.ts`/`*-upload.client.ts` functions in `packages/social`
   that steps 2–3 call into, and decide whether it needs the presigned-URL fetch-from-URL upload
   model (Meta-style platforms) or a real byte-stream upload (LinkedIn/Pinterest/X-style) — this is
   a real per-platform API difference, not a convention this app imposes.
