# Dataset Validation & Calibration (Milestone 1.5)

Inserted between [`ai/dataset-feedback-loop.md`](dataset-feedback-loop.md) (Milestone 1) and Fusion
Engine v3 (Milestone 2, not yet started) in the post-hardening roadmap. Its purpose: surface
data-quality insights *before* M2's model-training work starts, so that work is better-targeted
instead of jumping straight from raw data to a trained model.

Format: CLI/report scripts, same pattern as `check-calibration-coverage.ts` and
`export-training-dataset.ts` — this milestone's audience is engineering deciding calibration, not
end users, and a web UI would mostly show "insufficient data" today. Revisit as a real `apps/web`
dashboard once there's data worth visualizing persistently.

## One report, six sections

`apps/worker/src/scripts/generate-dataset-report.ts` (`pnpm report:dataset-health`) consolidates all
7 originally-requested deliverables into one markdown+JSON report rather than 7 separate CLI tools —
**Dataset Health Report** is the natural rollup of the other 6 plus an overall readiness verdict, not
a separate computation:

- **Dataset Quality** — total clips with computed features, usable samples for correlation, and a
  one-line verdict.
- **Missing Data Report** — for every Fusion Engine feature key seen across the dataset, what
  fraction of clips are missing it. Surfaces exactly the kind of gap already called out in
  `packages/fusion-engine/src/weights.ts`'s comments (e.g. `composition` has no caller anywhere in
  `apps/worker` yet, so `compositionFeatures` shows up as ~100% missing there too) without needing to
  read source comments to know it.
- **Feature Distribution** — per numeric feature: count/min/max/mean/median/stddev/p25/p75. Every
  Fusion Engine signal feature should sit in `[0,1]` per `feature-pipeline.ts`'s `NORMALIZERS`
  registry — a feature whose observed range violates that is a real normalization bug.
- **Feature Drift Detection** — splits clips by `createdAt` at the median into earlier/later
  halves and flags features whose mean shifted by more than 25% (heuristic, unvalidated threshold)
  between them. Catches a silent upstream detector/model change before it contaminates calibration.
- **Correlation Dashboard** — same Pearson correlation read as `export-training-dataset.ts`,
  reused via `dataset-lib.ts` rather than recomputed.
- **Weight Calibration Report** — groups correlation results by signal, averages `|correlation|`
  per signal, and normalizes to the same total-mass convention `DEFAULT_FUSION_WEIGHTS` uses.
  **Explicitly a suggestion for a human to review, not something that auto-edits
  `packages/fusion-engine/src/weights.ts`** — matches the "every weight change validated against
  real behavior, not auto-applied" spirit already established there for `editingRhythm`'s own weight
  history.

## Two data tiers (`apps/worker/src/scripts/dataset-lib.ts`)

The key finding that shapes this milestone: most sections don't need to wait for Milestone 1's
engagement data at all.

- **`loadClipsWithFeatures`** — every `Clip` row with a computed `highlightBreakdown`, regardless of
  publish status. The Fusion Engine has been populating this since v1/v2 (in production already), so
  Missing Data / Feature Distribution / Feature Drift are useful *immediately*, not blocked on any
  clip ever being published. Returns `TimestampedRecord[]` (`{ record: DatasetRecord; createdAt: Date }` — a wrapper, not an intersection, because `DatasetRecord`'s `[featureKey: string]: string | number | null` index signature can't hold a `Date` directly).
- **`loadUsableSamples`** — the engagement-joined subset from Milestone 1, extracted verbatim from
  `export-training-dataset.ts` so both scripts share the exact same join instead of risking drift
  between two copies. Gated at `MIN_SAMPLES_FOR_CORRELATION` (20) before Correlation/Weight
  Calibration compute anything.

`flattenClipFeatures`/`pearsonCorrelation` also live in `dataset-lib.ts` now (moved from
`export-training-dataset.ts`, which re-exports them for backward compatibility with its own existing
tests).

## Verified against dev data (2026-07-12)

Ran against the dev database with 2 real clips that have computed features: Missing Data and Feature
Distribution produced real per-feature tables immediately, while Feature Drift (needs ≥10 total
records) and Correlation/Weight Calibration (needs ≥20 engagement samples) correctly fell back to
"insufficient data" messages instead of crashing or producing misleading output on 2 samples — this
is the intended graceful-degradation behavior, not a bug to fix later.

## Milestone 5C-B: this milestone's logic now also has a web UI

This milestone's "a web UI would mostly show 'insufficient data' today" caveat above is now stale —
Milestone 5C-B (AI Operations Dashboard, see `docs/backend.md` and `docs/frontend.md`) gives
Missing Data/Feature Distribution/Feature Drift/Correlation/Weight Calibration a real `/ops/ai` page
for the first time, alongside new AI Health/Signal Analytics/Score Distribution/Training Readiness
sections. `generate-dataset-report.ts`'s CLI report still exists unchanged and remains the
markdown+JSON tool for a one-off deep dive; `/ops/ai` is the always-on, role-gated (`ADMIN`/
`AI_ENGINEER`/`OPERATOR`) equivalent for day-to-day monitoring.

`computeMissingDataReport`/`computeFeatureDistribution`/`detectFeatureDrift`/
`computeWeightCalibrationSuggestions` (previously `apps/worker/src/scripts/dataset-quality.ts`) and
`flattenClipFeatures`/`pearsonCorrelation`/`MIN_SAMPLES_FOR_CORRELATION` (previously
`apps/worker/src/scripts/dataset-lib.ts`) moved verbatim to a new package, `packages/dataset-quality`
— `apps/api` cannot import from `apps/worker` (apps only talk over HTTP/queue), and this logic was
already real and tested, worth sharing rather than re-implementing. `dataset-lib.ts`/
`dataset-quality.ts` re-export everything under their old names (same backward-compat pattern
`export-training-dataset.ts` already used for its own re-exports), so nothing in `apps/worker`
needed to change. `apps/api`'s `OpsAiService` (`apps/api/src/ops-ai/`) writes its own Prisma
queries (system-wide, no `ownerId` filter — there wasn't one here either) mirroring
`loadClipsWithFeatures`/`loadUsableSamples`'s shape, then calls the shared package functions — "a
stateless module never queries the DB itself" (`ARCHITECTURE.md`).
