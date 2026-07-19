# Worker architecture: the flow, not the file list

`docs/worker.md` documents each job handler's implementation; `docs/queue.md` documents BullMQ
queue/retry mechanics. This doc is the layer between them: **why** the pipeline is shaped the way
it is, told as one flow — Queue → Worker → Snapshot → Retry → Failure isolation — rather than
per-handler detail. Read this first if you're new to `apps/worker`; read the other two when you
need to change a specific job or queue.

## The flow

```
Queue (BullMQ/Redis)
   │  job payload: IDs + the few fields genuinely needed at enqueue time
   ▼
Worker (apps/worker, no HTTP server)
   │  re-fetches current DB state, does the work, self-chains the next stage
   ▼
Snapshot (one atomic Postgres write)
   │  data + Video.status/VideoStatus­Event committed together, or neither is
   ▼
Retry (VideosService.retry, apps/api)
   │  infers which stage to redo from what data already exists — no stored
   │  "failed at" marker needed, because Snapshot never leaves that ambiguous
   ▼
Failure isolation
      one job's crash never corrupts a sibling's data, a partial write, or
      an unrelated queue
```

## Queue → Worker

`apps/api` only ever enqueues the *first* pipeline stage (`TRANSCRIBE` on upload,
`IMPORT_YOUTUBE` on a YouTube URL submission) — every subsequent stage
(`TRANSCRIBE → DETECT_CLIPS → RENDER_CLIP`) is enqueued by the *previous* stage's own worker on
success (`docs/queue.md`'s self-chaining). This keeps all pipeline sequencing logic inside
`apps/worker`; `apps/api` never needs to know what stage follows what.

`DETECT_CLIPS`'s success enqueues **one `RENDER_CLIP` job per candidate clip**, not one batch job
for the whole video — the first place independent-failure-domain thinking shows up in this
pipeline, before a single frame has been rendered. `PUBLISH_CLIP` is enqueued from two different
places (`ClipsService.publish()` in `apps/api` for an immediate publish, `schedule-publish-clip`'s
repeatable job in `apps/worker` for a scheduled one) but is still just one queue with one worker —
the caller doesn't change the job's shape or behavior.

Job payloads are minimal by design (`docs/queue.md`'s Job payload convention) — workers always
re-fetch current DB state rather than trusting what was true at enqueue time, so a job that sits in
the queue for a while (backlog, worker restart) never acts on stale data.

## Worker → Snapshot: one atomic write, not a sequence of writes

"Snapshot" in this pipeline means one specific, recurring shape: **the job's output data and its
status-transition record are committed in a single Postgres transaction, so a crash between them
is impossible by construction.** Three concrete instances, in increasing order of what they're
protecting against:

**1. Pipeline-stage snapshots (`transcribe`/`render-clip`).** `transcribe.worker.ts` writes
`TranscriptSegment` rows, the `Video` row (`status: TRANSCRIBED`, plus derived fields like
`voiceActivityFeatures`), and a `VideoStatusEvent` audit row in one `prisma.$transaction([...])`
(`apps/worker/src/workers/transcribe.worker.ts:618-635`) — never three separate writes. The shared
helper behind this, `updateVideoStatus()` (`packages/database/src/video-status.ts:32`), is the
**only** sanctioned way to change `Video.status` after creation; its own doc comment says so
explicitly, and every pipeline worker's failure path calls it rather than writing `status` directly.
Every `FAILED` transition also fires exactly one notification hook (`RENDER_FAILED`) from inside
this same function — one hook point instead of four duplicated ones across the stage workers.

`render-clip.worker.ts` goes one step further because it has a real concurrency hazard BullMQ's own
stalled-job recovery can trigger for real (observed in production, not theoretical): two executions
of the *same* render job racing. The fix is an optimistic-concurrency claim baked into the update's
`where` clause — `tx.clip.update({ where: { id: clipId, outputUrl: null }, ... })`
(`apps/worker/src/workers/render-clip.worker.ts:716-717`). A clip's `outputUrl` starts `null` and
this is the only write that ever sets it, so "still `null`" means no other execution finished
first. The loser's update matches zero rows — Prisma reports `P2025`, caught and treated as benign
(`render-clip.worker.ts:750-760`), not an error. The clip update and the conditional "every sibling
now rendered → advance `Video.status` to `RENDERED`" transition are done in the *same* transaction
(`render-clip.worker.ts:715-749`) for the same reason `transcribe` does it: a crash between "clip
saved" and "video status advanced" can never leave those two facts disagreeing.

**2. Time-series snapshots (`sync-publish-stats`/`sync-follower-count`).** `PublishRecordStatsSnapshot`
and `SocialAccountFollowerSnapshot` are **append-only** — every sync run inserts a new row, never
updates a previous one (see their schema comments in `packages/database/prisma/schema.prisma`).
This is failure isolation in a different sense than the pipeline-stage case above: since a snapshot
row is never mutated after creation, a sync run that crashes mid-batch can never corrupt a
previously-written snapshot, only fail to add a new one. `PublishRecord`'s own `viewCount`/
`likeCount`/`commentCount` columns are updated in place as a "latest known" convenience value
alongside the snapshot insert (`apps/worker/src/workers/sync-publish-stats.worker.ts:75-102`) — two
different persistence models for two different questions ("what's the current number" vs. "what's
the history"), not an inconsistency.

**3. Claim snapshots (`schedule-publish-clip`).** The 60s poller claims a due `SCHEDULED` row via
`updateMany({ where: { id, status: SCHEDULED }, data: { status: QUEUED } })` and only enqueues
`PUBLISH_CLIP` if exactly one row was affected (`docs/queue.md`'s Repeatable jobs section,
`docs/backend.md`'s Scheduling section) — the same optimistic-concurrency shape as render-clip's
`outputUrl: null` claim above, applied to "did I win the race to process this scheduled publish"
instead of "did I win the race to render this clip." Losing Redis state only delays the next poll;
it can never double-fire a publish, because the claim lives in Postgres, not in a BullMQ delayed
job.

## Snapshot → Retry: atomicity is what makes stage-inference possible

`VideosService.retry` (`apps/api`, see `docs/database.md`'s Retry inference section) has no stored
"which stage failed" marker at all. It doesn't need one, **because** every pipeline-stage snapshot
above is atomic: if a job's `catch` block ran, that stage's data was *never written at all* — not
partially written, not written-but-unflagged. So the retry logic can just look at what data exists
and infer the stage from it:

- No `TranscriptSegment` rows → retry `transcribe`.
- Segments exist but no `Clip` rows → retry `detect-clips`.
- `Clip` rows exist but some lack `outputUrl` → retry `render-clip`, **only** for those clips
  (each renders independently — see Queue → Worker above).
- `Video.sourceUrl === ''` with an `importSourceUrl` set → retry `import-youtube`.

This is the single biggest payoff of the Snapshot pattern in this codebase: it turns "what should a
retry do" from a bookkeeping problem (maintain a separate status-tracking column, keep it in sync
with reality) into a pure read of already-durable state. If any pipeline-stage write above were
ever split into two non-transactional steps, this inference would become unreliable the moment a
crash landed between them.

## Failure isolation, one level down: independent AI sub-modules inside `render-clip`

Everything above isolates one *job* from another. Inside a single `render-clip` job, the same
principle repeats one level down: `docs/worker.md`'s pipeline steps 1-4 (face detection/reframe,
scene-cut detection, facial/gesture/landmark intelligence, OCR) are each wrapped in their own
independent `try`/`catch`. A failing detector degrades that one signal to absent/null and lets the
render continue — it never fails the whole job. The general principle: **a signal that can't be
computed is missing data, not a fatal error**, because the Fusion Engine (`docs/ai/fusion.md`)
is explicitly built to score a clip on whatever subset of signals actually has data (its
`confidence` calculation is literally a function of *how much* data was available). A job-level
failure (thrown past every inner `try`/`catch`, reaching the outer one) is reserved for genuinely
unrecoverable conditions — FFmpeg itself failing, storage unreachable, a network error mid-upload —
which is what triggers the `FAILED` Snapshot write described above, not a single AI sub-module
having nothing to say about this clip.

## Queues this flow deliberately does NOT apply to

`PUBLISH_CLIP` is the one queue with BullMQ's own `attempts: 3` exponential-backoff retry
(`docs/queue.md`) instead of the Snapshot-then-manual-retry pattern above — a platform API's
transient failures (rate limits, 5xx) are judged not to need user judgment the way a pipeline-stage
failure does. It still writes its own `PublishRecord.status`/`errorMessage` on final failure, just
without the atomic multi-table transaction shape (there's no second table whose state could
disagree with it the way `Clip`/`Video` can).
