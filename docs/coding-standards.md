# Coding Standards

## Language & shared types

TypeScript everywhere (`apps/web`, `apps/api`, `apps/worker`, `packages/*`). Any contract shared
across apps — job payloads, status enums, DTOs — is defined once in `packages/shared` and
imported, never duplicated. BullMQ jobs are named verb-noun (`transcribe`, `detect-clips`,
`render-clip`, `publish-clip`); their payload/result types live in `packages/shared`.

## JSON-contract module checklist

See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for the full checklist when adding a new stateless
analysis module. Summary:

1. Define the input/output Zod schema in `packages/contracts/src/<name>.ts`.
2. Build the module in its own `packages/<name>` package — pure function(s), `deps` parameter for
   anything external (subprocess, API client, file paths derived from `__dirname`/`process.env`).
3. Write an adapter inside the relevant `apps/worker` job handler that narrows the DB row to the
   module's input, calls it, persists the result.
4. If the module is a Fusion Engine signal, extend `fusionInputSchema` (`packages/contracts/src/
   fusion.ts`) and `packages/fusion-engine`'s feature extraction/normalization — extend the
   existing pipeline, never rebuild it from scratch (this has been an explicit user directive
   since the Fusion Engine v1→v2 transition).
5. Test the module with plain fixtures, zero DB/queue mocks. Test the adapter separately, mocking
   the module itself, asserting orchestration only (persist shape, status transitions, enqueue
   calls, Sentry tags).

`deps` injection is not just "external API clients" — anything environment/deployment-specific
(subprocess executable names, model file paths, env var reads) belongs in `deps`, not inside the
module. A module reading `process.env` or building a path from `__dirname` internally is a sign it
needs refactoring.

## Extraction discipline

Extract shared logic to a common util/package **at the third duplication**, not the second — e.g.
`filterSegmentsForClip` (`packages/shared/src/utils/transcript.ts`), `sanitizeHashtags`,
`GRAPH_API_VERSION`/`GRAPH_BASE_URL` (`packages/social`'s `instagram-graph.ts`). Two duplicates is
tolerated; a third is the signal to extract. Exception: OAuth/token-encryption code was shared
starting at the *second* duplication (Fase 6b) — that class of bug (a subtle drift = a security
hole or a silently broken publish job) is expensive enough to justify sharing early.

Don't add abstractions, error handling, or validation for scenarios that can't happen. Trust
internal code/framework guarantees; validate only at system boundaries (user input, external
APIs, LLM output).

## "Scale honesty" — don't overclaim what a heuristic is

Every heuristic/model output in this codebase is documented as exactly what it is, not oversold:

- LLM-derived scores (`ClipScores`, `highlightScore`'s weights) are explicitly **not** trained/
  calibrated against real engagement data — they're a reasonable starting point, documented as
  such in code comments, not presented as a trained prediction.
- Proxy metrics are labeled as proxies (e.g. `mouthContrastRatio` for "occlusion", `sharpness` for
  both "blur detection" and "sharpness score", `landmarkJitterScore`'s reliance on a proxy
  "landmark confidence" since MediaPipe FaceLandmarker doesn't expose real per-landmark
  confidence).
- Emotion classifiers trained on acted/scripted data (IEMOCAP for vocal emotion, FER+ for facial
  expression) are flagged as distribution-shifted relative to this app's real talking-head/
  interview footage — useful if right, safe to ignore if wrong, never the sole basis for a
  decision.
- New signals in the Fusion Engine are wired in at **weight 0** (collected, visible in
  `contributions`, not moving `highlightScore`) until there's real calibration data — see
  `ai/fusion.md`.
- Where a safety-relevant vocabulary constraint was given explicitly by the user (e.g. facial
  affect labels restricted to `positive_affect`/`high_energy`/`low_energy`/`expressive`/`neutral`,
  never a discrete emotion name), it's enforced in the type system (`AFFECT_LABELS` union), not
  just a comment.

## Data shape conventions

- **Always an array, never null** — for fields where "analysis ran and found nothing" is a valid
  outcome (`sceneCuts`, `topics`, `keywords`, `emojiSuggestions`, `motionEnergy`): default `[]`,
  the detector itself swallows its own failures internally.
- **Null distinct from empty array** — for fields where "analysis never ran / failed entirely"
  needs to be distinguishable from "ran and found nothing" (`facialEmotions`, `gestures`,
  `cameraMotion`, `sceneCutEvents`, `ocrText` is the array-always exception — see `ai/ocr.md`):
  `null` on total failure, `[]`/populated array otherwise. The corresponding `*Features` derived
  summary is `null` exactly when its raw column is `null`.
- **`Prisma.JsonNull`, not plain `null`** — writing an explicit SQL `NULL` to a `Json?` column
  requires Prisma's `Prisma.JsonNull` sentinel; a bare `null` is ambiguous with "field not
  provided" to Prisma's client. Every adapter that clears a Json column on detector failure uses
  this (`facialEmotions: facialEmotions ?? Prisma.JsonNull`).
- **"Module throws, adapter catches"** — subprocess-backed modules (`detectFaces`,
  `detectFacialEmotion`, `detectGestures`, `detectFaceLandmarks`, `detectCameraMotion`) propagate
  errors up; the *adapter* in `render-clip.worker.ts` wraps each call in its own try/catch so one
  failing detector never fails the whole render job. ffmpeg-based modules
  (`detectSceneCuts`, `classifySceneCutTypes`, `analyzeMotionEnergy`) instead swallow their own
  failures internally and return an empty result — a deliberate split, not an inconsistency: pure
  ffmpeg calls have a much narrower failure surface than a full Python/model subprocess.

## The TS2742 Prisma pitfall

Adding a new `Json?` column to `Clip`/`Video` in `schema.prisma` reliably breaks `apps/api`'s
`nest build` with `error TS2742` ("inferred type ... cannot be named without a reference to
.../prisma/client/runtime") wherever that field leaks through an unnarrowed `...clip` /
`...video` spread. Recurred well over a dozen times across the AI Fusion roadmap. The fix is
always the same: destructure the new field out of the spread, and write a small
`toShared<FieldName>()` narrowing function in `apps/api/src/videos/transcript-segment.util.ts`,
used by both `VideosService.mapVideoWithClips` and `ClipsService.toDto`. **New fields added to an
already-`Json?` column** (e.g. adding `eyeContactRate` to the existing `faceLandmarkFeatures` blob)
do *not* trigger this — only a brand-new Json *column* does. Run `apps/api`'s `nest build`
(declaration emit), not just `tsc --noEmit`, to catch this — a plain typecheck can miss it.

## `apps/web` exhaustive-map gotcha

Components with a `Record<keyof SomeSharedType, ...>` map (e.g. `TimelineEditor.tsx`'s and
`VideoAnalysisDashboard.tsx`'s `SCORE_LABELS: Record<keyof ClipScores, string>`) will fail
`next build`'s type-check the moment a new key is added to that shared type in `packages/shared`,
even if nothing in `apps/web` was touched. Always run the full monorepo build
(`pnpm -r build`), not just the app you meant to change, whenever a `packages/shared` type
changes.
