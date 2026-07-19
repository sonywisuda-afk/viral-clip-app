# Analytics Architecture

A flow-level view of how a published clip's real-world performance becomes a number on a
dashboard, then a narrative, then a projection. This complements `backend.md`'s endpoint-by-
endpoint reference (`AnalyticsController`/`WorkspaceAnalyticsController`/`CampaignsController`)
rather than replacing it — that doc answers "what routes exist"; this one answers "how does data
move between them and why is it shaped this way." Everything here shipped across Sprint 6A-6K
(the "Opus-Clip-equivalent Analytics Dashboard" initiative) plus its Milestone 5A/5B/1/1.5
foundations; `backend.md`'s own endpoint list predates Sprint 6A-6K and doesn't yet enumerate the
routes this doc covers (`/analytics/heatmap`, `/analytics/followers`, `/clips/:id/performance`,
`/campaigns/:id/analytics`, `/workspaces/:id/analytics/*`) — a documentation gap this doc closes,
not a contradiction of what's there.

The flow has six stages: **Publish → Snapshot → Aggregation → Visualization → Insight →
Prediction**.

## 1. Publish

A `PublishRecord` row (see `data-ownership.md` for its full relationship map) is the unit
everything downstream keys off. It carries only a "latest known snapshot" of engagement
(`viewCount`/`likeCount`/`commentCount`, mutable, overwritten on every sync — a leftover
convention from before Milestone 1) and a `platformPostId` once actually published. Nothing about
analytics happens at publish time itself; publishing only creates the row a background job will
later attach engagement history to.

## 2. Snapshot

Two repeatable BullMQ jobs turn a live `PublishRecord`/`SocialAccount` into an **append-only**
history, never mutating a single row in place:

- **`sync-publish-stats`** (`apps/worker/src/workers/sync-publish-stats.worker.ts`, every 6h) —
  for every `PUBLISHED` record on a platform `platformsWithStatsSync()` reports, calls that
  platform's `adapter.syncStats()`, writes the result onto `PublishRecord`'s mutable columns
  *and* inserts a `PublishRecordStatsSnapshot` row (`capturedAt`, `viewCount`/`likeCount`/
  `commentCount`/`shareCount`/`watchTimeSeconds`, plus a computed `engagementScore` via
  `computeEngagementScore()` in `packages/social`). One record's failure (revoked token, deleted
  video, transient API error) is caught and logged per-record — it never aborts the rest of the
  batch. `shares`/`watchTime` are only ever populated where `platform-capability.util.ts` (see
  `capability-matrix.md`) says they're actually available; everywhere else they're `null`, not a
  fabricated `0`.
- **`sync-follower-count`** (`sync-follower-count.worker.ts`, daily — coarser than the 6h publish-
  stats cadence because a follower count doesn't need that freshness and costs exactly one API
  call per connected account regardless of how many clips it's published) — for every
  `SocialAccount` on a platform `platformsWithFollowerSync()` reports, inserts a
  `SocialAccountFollowerSnapshot` row (`capturedAt`, `followerCount`). Sprint 6F. Same per-account
  failure isolation as above. Critically: **no row is written for a failed or unsupported account**
  — absence of recent rows is itself the "not available" signal `platform-capability.util.ts`
  encodes, not a stored flag.

Both snapshot tables are append-only by design (see Milestone 1's `dataset-feedback-loop.md` for
the original rationale on `PublishRecordStatsSnapshot`): a mutable "latest number" can't answer
"how did this trend over the last 30 days," and every stage below — trend charts, growth
percentages, the Insight narrative's "compared to this creator's other clips," Prediction's
regression — needs the full history, not a point-in-time read.

## 3. Aggregation

`packages/analytics-report/src/aggregation/*.util.ts` is a pure-function package: no Prisma
access, no HTTP, no queue — every function takes already-fetched rows and returns a computed
shape. This exists as its own package (not inline in `apps/api/src/analytics/`) for one concrete
reason: `apps/worker` cannot import from `apps/api` (see `ARCHITECTURE.md`'s app-boundary rule),
but the Analytics Report PDF export (`apps/worker`'s `export-generate` job) needs to produce
*exactly* the same numbers the live dashboard shows for the same window — sharing one aggregation
package is what makes that guarantee possible instead of two hand-maintained implementations
silently drifting apart. `apps/api/src/analytics/analytics.service.ts` (owner-scoped, `ownerId`
filter) and `apps/api/src/workspace-analytics/workspace-analytics.service.ts` (workspace-scoped,
see `data-ownership.md` for why both scoping models coexist) both fetch rows via Prisma, then hand
them to the same aggregation functions:

- **`analytics.util.ts`** (Milestone 5A) — `computeAverageEngagementScore()` (latest snapshot per
  publish record, then averaged — `null`, never `0`, when nothing has a real score yet),
  `bucketUploadsByDay()` (zero-filled day buckets).
- **`performance.util.ts`** (Milestone 5B, extended Sprint 6B) — `bucketByPublishDate`/
  `bucketByPublishPeriod` (the latter generalizes the former to weekly/monthly/yearly via a real
  ISO-8601 week algorithm, `periodsForGranularity` translating a `days` window into a bucket
  count), `computeGrowthPct` (percent vs. the immediately preceding period of equal length, `null`
  — not a fabricated 0% or ±Infinity% — with no prior-period baseline), `computeGrowthSummary`
  (the one implementation of "growth" for Views/Engagement/Videos/Clips, called identically by the
  live dashboard and the PDF adapter so the two can never disagree), `computeConfidenceDistribution`.
- **`heatmap.util.ts`** (Sprint 6H) — publish-time-of-day heatmap cells, plus the shared
  `RETENTION_UNAVAILABLE`/`DROP_OFF_UNAVAILABLE`/`REPLAY_UNAVAILABLE` constants both
  `AnalyticsService` and `WorkspaceAnalyticsService` return verbatim (a single source of truth for
  *why* those three sections are unavailable, not two independently hand-typed explanations that
  could drift).
- **`leaderboard.util.ts`** (Sprint 6D) — one already-fetched candidate list feeds all 4 leaderboard
  dimensions (Top Clip/Creator/Campaign/Platform) in one pass, not four separate queries.
- **`campaign-analytics.util.ts`** (Sprint 6E) — a campaign-level rollup over only its `PUBLISHED`
  records (the only status with real snapshot data); `CampaignStatus` itself never filters
  anything here.
- **`fusion-signal-analytics.util.ts`** (Milestone 5C-A/5C-B) — aggregates Fusion Engine output
  (signal contribution %, `topFactors` frequency) — shared between owner-scoped `AnalyticsService`
  and system-wide `OpsAiService`, same functions over different candidate sets. See
  `fusion-to-insight.md` for how this relates to the Fusion Engine itself.
- **`prediction.util.ts`** (Sprint 6J) and `clip-narrative.util.ts` (Sprint 6I) — covered under
  Insight/Prediction below; both also live in this package.

## 4. Visualization

`apps/web/components/analytics/*` (see that directory's own `README.md`) is a small, deliberately
unabstracted chart foundation: `AnalyticsLineChart`/`AnalyticsBarChart` wrap Recharts with one
consistent look (tooltip, empty/loading state, color convention — signal-cyan for single-series,
explicit per-series color for multi-series since this app only has 2 named brand colors today).
No chart-type registry, no factory — every new analytics chart is built from these pieces
directly, and the README documents which of the two wrappers (or neither, for a KPI number/status
breakdown/heatmap grid) fits a new panel. This layer only renders what Aggregation already
computed; no chart component performs its own math.

## 5. Insight

Sprint 6I. `clip-narrative.util.ts`'s `generateClipNarrative()` — pure narrative composition, no
Prisma, **no LLM call, no new AI inference of any kind**. Every number it consumes is already
computed: the frozen Fusion Engine's `highlightExplainability`/`highlightBreakdown` (see
`fusion-to-insight.md`) and real `engagementScore` outcomes read from
`PublishRecordStatsSnapshot`. It classifies a clip as `over_performed`/`under_performed`/
`as_expected`/`not_enough_data` by comparing its own latest engagement score against the *median*
of its owner's other published clips (`MIN_HISTORICAL_SAMPLES = 5`, an arbitrary but documented
floor — this app has nowhere near enough production data to fit a real threshold yet, per
`fusion-v3.md`'s "0 usable samples" note), within a ±15% "as expected" band. `topSignals` (by
`|weightedContribution|`) and `lowSignals` (only signals with real weight > 0 — a still-weight-0,
not-yet-calibrated signal being numerically "low" isn't a finding about the clip) are what the UI
(`AiInsightPanel.tsx`) renders as "Kenapa Berpotensi Viral" / "Sinyal Terlemah." This narrates
*what already happened*; it does not project anything forward — that's a deliberately separate
concern, Prediction, composed alongside it by the caller
(`apps/api/src/clips/clip-performance.util.ts`'s `toClipPerformanceDto()`), not merged into one
function.

## 6. Prediction

Sprint 6J. `prediction.util.ts`'s `predictEngagement()` is a **heuristic statistical projection,
explicitly not a trained model**: a closed-form least-squares linear regression
(`highlightScore → engagementScore`) fit over a clip owner's *other* published clips (never the
clip's own data), reusing `packages/dataset-quality`'s exact `pearsonCorrelation`/
`MIN_SAMPLES_FOR_CORRELATION` (20) that `/ops/ai/correlation` already uses system-wide — called
here per-owner instead of pooled globally. Below 20 historical samples, or with no meaningful
correlation, it returns `available: false` with an honest `reason` and `sampleCount`/
`minSamplesRequired` — never a fabricated prediction. This is one of **three distinct systems that
can all be called "prediction" in this codebase** and are easy to conflate — see
`fusion-to-insight.md` for the full disambiguation:

1. `packages/fusion-engine`'s own `predict.ts` — a deterministic bucket classifier
   (`likely_high_performer`/`uncertain`/`likely_low_performer`) over one clip's own
   `highlightScore`/`confidence`, computed once at render time, stored on `Clip`.
2. **This** — Sprint 6J's `predictEngagement()`, a real (if simple) regression fit to a creator's
   own historical outcomes, computed on read (not stored), never touching the Fusion Engine.
3. `packages/fusion-ml`'s real gradient-descent ML pipeline (Fusion Engine v3, Milestone 2A/2B) —
   paused pending production data, zero call sites in `apps/worker`/`apps/api`, completely
   untouched by any of the above.

## Related: Traffic and Conversion

`ClipPerformanceDto`'s `traffic` section (`clip-performance.util.ts`) reports `conversionCount` per
publish record — summed `TrackedLink.clickCount` for that record, `null` (never a fabricated `0`)
when no `TrackedLink` was ever created for it. This is the one place Analytics Architecture and
Conversion Architecture touch; see `conversion-architecture.md` for how a click becomes that
counter in the first place.

## See also

- `data-ownership.md` — the entity relationships (`PublishRecord`, both snapshot models,
  `Campaign`, workspace vs. owner scoping) this flow is built on.
- `fusion-to-insight.md` — where the Fusion Engine's own output ends and this analytics layer's
  interpretation of it begins.
- `capability-matrix.md` — the per-platform-per-metric availability table that decides which
  numbers Snapshot can ever populate.
- `conversion-architecture.md` — the click-tracking pipeline feeding `traffic.conversionCount`
  above.
- `ai/dataset-feedback-loop.md` / `ai/dataset-validation-calibration.md` — Milestone 1/1.5's
  original `engagementScore`/`PublishRecordStatsSnapshot` rationale, which this doc builds on
  rather than restates.
