# Prisma conventions

`packages/database` is the **only** package that imports `@prisma/client` directly — every other
package (all the JSON-contract stateless modules) is deliberately DB-agnostic, per
`architecture.md`'s module pattern. `apps/api` and `apps/worker` both depend on
`packages/database` for schema/client access.

## `updateVideoStatus` / `recordVideoStatusEvent`

The sole sanctioned way to change `Video.status` (see `database.md`). `updateVideoStatus(prisma,
videoId, status, {data?, errorMessage?})` updates the `Video` row and inserts a `VideoStatusEvent`
row in one `$transaction`. `recordVideoStatusEvent()` is the event-insert half only, for callers
that need to fold it into their own existing transaction (e.g. `VideosService.upload()`'s
`video.create()`, where the row doesn't exist yet when the transaction starts).
`transcribe.worker.ts` inlines the event write as a third item in its own existing
`$transaction([segment.createMany, video.update])` rather than calling `updateVideoStatus`
separately, to keep the segment-insert + status-bump atomic.

## `Prisma.JsonNull`

Writing an explicit SQL `NULL` to a `Json?` column requires the `Prisma.JsonNull` sentinel — a
bare `null` is ambiguous with "field not provided" to Prisma's generated client. Every adapter
that clears a Json column after a failed detector uses this pattern:
`facialEmotions: facialEmotions ?? Prisma.JsonNull`. `ClipScores`/`llmFeatures` writes cast through
`as unknown as Prisma.InputJsonValue` since `ClipScores` is a closed interface without an index
signature.

## The TS2742 pitfall

See `coding-standards.md` — adding a new `Json?` column reliably breaks `apps/api`'s `nest build`
wherever the field leaks through an unnarrowed `...clip`/`...video` spread. The fix pattern is
always: destructure the field out of the spread in `VideosService.mapVideoWithClips` /
`ClipsService.toDto`, write a `toShared<Field>()` narrowing function in `apps/api/src/videos/
transcript-segment.util.ts`. This has recurred well over a dozen times across the AI Fusion
roadmap — it is the single most common build-breaking mistake in this codebase when adding a new
analysis signal, and running `apps/api`'s actual `nest build` (not just `tsc --noEmit`) is the only
reliable way to catch it.

## Test suite

`packages/database` has its own Jest suite (added alongside `VideoStatusEvent`) specifically for
`video-status.ts` — it was the first (and remains one of the only) `packages/database` tests, since
most of Prisma's own behavior doesn't need re-testing; only this project's helper functions do.
