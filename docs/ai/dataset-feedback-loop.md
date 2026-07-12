# Dataset & Feedback Loop (Milestone 1)

The foundation for every later item in the post-hardening AI-quality roadmap (Fusion Engine v3's
ML-based weighting, Feedback Learning, Online Learning) — all of them need real engagement outcomes
joined against the AI features Speedora already computes per clip. `check-calibration-coverage.ts`
(`apps/worker/src/scripts`) had already established the actual gap: 0 clips with both
`editingRhythmFeatures` and a linked `PublishRecord.viewCount`, as of 2026-07-10. This milestone is
what closes that gap once production traffic exists.

**Next**: [Milestone 1.5, Dataset Validation & Calibration](dataset-validation-calibration.md) turns
this raw dataset into a Missing Data / Feature Distribution / Feature Drift / Correlation / Weight
Calibration report before Milestone 2 (Fusion Engine v3) starts training anything on it.

## What's new

- **`PublishRecordStatsSnapshot`** (`packages/database/prisma/schema.prisma`) — an append-only
  history table, one row per `sync-publish-stats` run, same shape convention as `VideoStatusEvent`
  (no `fromValue`, always sequential). `PublishRecord`'s own `viewCount`/`likeCount`/`commentCount`
  columns are unchanged and remain a mutable "latest snapshot" — nothing that reads them today
  breaks.
- **`shareCount`** — now fetched for TikTok (`share_count` field on `video/query/`) and Instagram
  (`shares` Insights metric, already reachable under the existing `instagram_manage_insights`
  scope). YouTube's Data API `statistics` resource has no comparable concept.
- **`watchTimeSeconds`** — Instagram only, via the `ig_reels_avg_watch_time` Insights metric
  (existing scope, no reconnect required).
- **`engagementScore`** — see formula below.
- **`apps/worker/src/scripts/export-training-dataset.ts`** (`pnpm export:dataset`) — joins each
  clip's AI features against its latest performance snapshot, writes a flat JSON dataset, and prints
  a Pearson-correlation read against `engagementScore` once there's enough data.

## `engagementScore` formula (heuristic, unvalidated)

`packages/social/src/engagement-score.ts`:

```
engagementScore = (likes + comments*3 + shares*5) / views
```

Comments and shares are weighted higher than a passive like as stronger engagement signals — same
"scale honesty" caveat as `editingRhythm`'s Fusion Engine weight (`ai/fusion.md`): this is a
starting guess, not a validated formula. Revisit once the export script has enough real samples to
check whether it actually correlates with anything. `null` whenever `viewCount` is `null`/`0`.

## `export-training-dataset.ts`

Run via `pnpm --filter @speedora/worker export:dataset [outputPath]` (defaults to
`apps/worker/dataset-export.json`). For every clip with at least one `PublishRecordStatsSnapshot`:

1. Takes the most-recently-captured snapshot across all of that clip's `PublishRecord`s (a clip can
   have one per platform) as the outcome row.
2. Flattens `Clip.highlightBreakdown` — the Fusion Engine's `FusionOutput.contributions` array —
   into `signal.feature -> normalizedValue` keys, plus `viralityScore`/`highlightScore`/
   `highlightConfidence` as top-level features.
3. **Deliberately uses `normalizedValue`, not `weightedContribution`.** Most Fusion Engine signals
   (composition, gesture, faceGeometry, sceneMotion, cameraMotion, speaker, object) still sit at
   weight 0 pending calibration (`ai/fusion.md`) — their `weightedContribution` is always 0, which
   would make it impossible to ever discover they deserve a real weight. `normalizedValue` is the
   pre-weighting signal calibration actually needs.
4. Writes the flat dataset to JSON, then prints each feature's Pearson correlation against
   `engagementScore`, sorted by `|correlation|` descending — once at least 20 samples have a
   non-null `engagementScore`. Below that floor it prints a "not enough data yet" message instead of
   a misleading table, mirroring `check-calibration-coverage.ts`'s honesty about sample size.

`flattenClipFeatures`/`pearsonCorrelation` are exported and fixture-tested
(`export-training-dataset.spec.ts`) independent of the DB-querying `main()`, matching the existing
module-vs-adapter test split (`testing.md`).

## Known gaps (explicit scope cuts, not oversights)

- **YouTube watch-time/CTR/impressions** — needs the `yt-analytics.readonly` OAuth scope (separate
  from the currently-requested `youtube.upload`/`youtube.readonly`) and calls against the YouTube
  Analytics API (`youtubeAnalytics.reports.query`), not the Data API's `videos.list` used today.
  Deferred because it requires every already-connected user to reconnect their YouTube account, and
  the scope may need a Google app verification review. Revisit as a dedicated follow-up once that
  cost is worth paying.
- **TikTok watch-time/retention** — no comparable endpoint exists on the Content Posting/Upload-to-
  Inbox API surface today. A hard platform limitation, not something client-side work can fix.
- **Historical AI-feature snapshots** — not needed. `Clip.*Features`/`highlightBreakdown` are
  computed once at render time and don't change afterward, so `export-training-dataset.ts` reads
  them directly off `Clip` rather than duplicating them into a snapshot table.
