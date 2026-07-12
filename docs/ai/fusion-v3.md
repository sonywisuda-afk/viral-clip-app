# Fusion Engine v3 (Milestones 2A-2B)

> **v2 (`packages/fusion-engine`, see `ai/fusion.md`) is the only engine actually running in
> production.** Nothing in this document is live. `packages/fusion-ml` is a complete, tested, but
> currently **uncalled** package — the same "exists and is fully tested, but nothing invokes it
> against real clips yet" status `packages/composition-intelligence` had for a while (see
> `packages/fusion-engine/src/weights.ts`'s comment on the `composition` signal). As of Milestone
> 2B, the pipeline is **real, not just framework** — real gradient-descent linear regression, a
> real Prisma-backed dataset builder, real deterministic versioning — but still zero production
> behavior change and zero new call sites in `apps/worker`/`apps/api`. Running it against real
> production data today correctly reports 0 usable samples (see "Why this exists" below), the same
> honest-degradation pattern Milestone 1/1.5's scripts already established — "no production model
> trained" is satisfied literally, not by leaving the pipeline unbuilt.

## Roadmap sequence

This initiative has its own lettered sequence, inserted into the top-level numbered roadmap
(see `CLAUDE.md`'s Status section) between Milestone 2 (Fusion Engine v3) and Milestone 3:

```
M2A Foundation (done)  →  M2B Real ML Pipeline (done)  →  wait for production samples  →
M2C Baseline ML Training  →  M2D Calibration  →  M2E Canary Rollout  →  M2F Production Switch
```

Framed by the user: Speedora has moved past "building features" into "building an AI platform that
can safely experiment." M2A/M2B's job isn't a smarter model — it's making sure the whole pipeline
(real dataset access, versioning, evaluation, registry) is ready so that once production data is
sufficient, a model can be trained/compared/released without disrupting v2, which stays the
production path throughout.

## Why this exists

Milestone 1 (`ai/dataset-feedback-loop.md`) built the engagement dataset; Milestone 1.5
(`ai/dataset-validation-calibration.md`) built the tooling to validate it. Milestone 2 (Fusion
Engine v3) is where that dataset finally trains something — but training needs somewhere to land:
stable contracts for what a feature vector/training sample/prediction/ranking/model-version even
*is*, interfaces for the pipeline stages, and a way to evaluate a candidate model before trusting it.
M2A built all of that ahead of the real training work, the same "define the contract before the
consumer that implements it" precedent `ARCHITECTURE.md` documents for Fusion Engine v1 itself. M2B
makes the pipeline real: a genuine Prisma-backed dataset builder, real deterministic dataset/feature
versioning, a real evaluation runner, and a real (if simple) trained model — still gated on
production data that doesn't exist yet (0 usable samples, confirmed by both M1's
`export-training-dataset.ts` and M1.5's `generate-dataset-report.ts`, and reconfirmed by M2B's own
`run-fusion-v3-pipeline.ts` script).

## Architecture

```
packages/contracts/src/fusion-ml.ts   Zod schemas: FeatureVector, TrainingSample,
                                       PredictionResult, RankingResult, ModelMetadata,
                                       DatasetVersion, FeatureSchema (M2B),
                                       FUSION_V2_TO_V3_SIGNAL_MAP (M2B)

packages/fusion-ml/src/
  interfaces.ts                       FeatureExtractor, DatasetBuilder, ModelTrainer,
                                       ModelEvaluator, Predictor - interfaces
  feature-flags.ts                    isFusionV3Enabled() - env-var convention,
                                       not consumed anywhere yet
  model-registry.ts                   ModelRegistry interface + InMemoryModelRegistry
  model-serialization.ts              serializeModel/deserializeModel
  feature-registry.ts                 (M2B) FeatureRegistry + InMemoryFeatureRegistry,
                                       computeFeatureVersion()
  pipeline.ts                         (M2B) runFusionV3Pipeline() - the full orchestrator
  dataset/                            DatasetLoader, loadMockDataset, train/val split,
                                       feature normalization, feature schema validation,
                                       computeDatasetVersion() (M2B)
  evaluation/                         Precision@K, Recall@K, Spearman, NDCG,
                                       compareEngines(), runEvaluation() (M2B)
  baseline/                           (M2B) BaselineLinearModelTrainer/Predictor -
                                       real gradient-descent linear regression
  mock/                               One concrete implementation per interface -
                                       Mock{Predictor,ModelTrainer,ModelEvaluator,
                                       FeatureExtractor,DatasetBuilder}

apps/worker/src/
  ml/production-dataset-builder.ts    (M2B) ProductionDatasetBuilder - the real,
                                       Prisma-backed DatasetBuilder. recordToTrainingSample()
                                       bridges Milestone 1.5's DatasetRecord into a v3
                                       TrainingSample via FUSION_V2_TO_V3_SIGNAL_MAP
  scripts/run-fusion-v3-pipeline.ts   (M2B) real entry point (`pnpm pipeline:fusion-v3`,
                                       `--mock` for a synthetic-data dry run)
```

Every real, unit-tested piece (evaluation metrics, train/val split, normalization, schema
validation, checksums, model serialization) needs no ML at all — it's pure data-shape math. Every
interface (`FeatureExtractor`/`DatasetBuilder`/`ModelTrainer`/`ModelEvaluator`/`Predictor`) has
exactly one `Mock*` implementation, because a bare TS interface has nothing to unit-test directly —
only an implementation or a consumer is testable (`docs/testing.md`'s researched convention).
`MockPredictor` is the one exception worth calling out: when constructed with a real v2 `FusionInput`
fixture, it genuinely calls `@speedora/fusion-engine`'s real `computeHighlightScore` — proving the
whole evaluation framework can run against real v2 output today, not just mocks comparing against
other mocks (see `mock-predictor.spec.ts`).

`packages/fusion-ml` follows `ARCHITECTURE.md`'s stateless-module shape
(`(input, deps?) => Promise<Output>`) and has no DB/queue access — same "no DB/queue access at all"
status as `packages/fusion-engine`, `packages/composition-intelligence`, etc.

## Feature pipeline

v3's feature-signal set is a deliberate 8-signal subset of v2's 13 `FUSION_SIGNALS`
(`packages/contracts/src/fusion.ts`), given by explicit user direction:

```
Audio → Scene → OCR → Emotion → Gesture → Composition → Speaker → Camera Motion
```

Encoded as `FUSION_V3_SIGNALS` in `packages/contracts/src/fusion-ml.ts` — its own ordered tuple,
not derived from v2's `FUSION_SIGNALS`. Omits `sceneMotion`, `faceGeometry`, `object`, `llm`,
`editingRhythm`. The order matters: `FeatureVector.featureNames`/`values` are parallel arrays, and a
real training pipeline needs that ordering to stay identical between training and inference — this
tuple is the single source of truth for it.

`FeatureVector`'s shape (`{ clipId, featureNames: string[], values: number[], extractedAt }`)
deliberately mirrors Milestone 1.5's `DatasetRecord`
(`apps/worker/src/scripts/dataset-lib.ts`: `{ clipId, [featureKey]: number }`) rather than v2's
nested per-signal `FusionInput` shape. `packages/fusion-ml` cannot depend on `apps/worker`
(packages don't depend on apps), so this isn't a code dependency — just a shape choice that made
M2B's bridge a reshape, not a redesign.

**M2B: the v2→v3 bridge is now real.** `FUSION_V2_TO_V3_SIGNAL_MAP`
(`packages/contracts/src/fusion-ml.ts`) maps v2's `FUSION_SIGNALS` keys onto v3's — every key maps
to itself except `facial` (v2, expression classification) → `emotion` (v3's own naming, per the
original 8-signal list). `apps/worker/src/ml/production-dataset-builder.ts`'s
`recordToTrainingSample()` uses this map to filter a `DatasetRecord`'s `signal.feature` keys down to
only the 8 v3 signals, rename the signal prefix, and sort the result alphabetically for a
deterministic feature ordering — the actual, concrete `featureNames` list a given batch of clips
produced (not a fixed hardcoded list, since which named features exist per signal depends on which
v2 detectors happened to run).

## Training pipeline

`packages/fusion-ml/src/pipeline.ts`'s `runFusionV3Pipeline()` (M2B) is the real orchestrator,
proven end-to-end by `pipeline.spec.ts` — this **is** Milestone 2B's "End-to-End Pipeline
Verification," an automated test, not just a manual script:

```
DatasetBuilder.build(sampleIds)     ProductionDatasetBuilder (real, Prisma-backed, apps/worker)
        ↓                            or MockDatasetBuilder (fixtures, packages/fusion-ml)
computeDatasetVersion()             (M2B) deterministic sha256 checksum of the sorted sample
        ↓                            set - same content always produces the same versionId,
        ↓                            regardless of input order
computeFeatureVersion() + FeatureRegistry.register()   (M2B) checksums the observed
        ↓                            featureNames list (order-sensitive, unlike dataset
        ↓                            versioning - a reorder really is a different schema)
splitTrainValidation()              (positional split, not shuffled - see its own doc comment)
        ↓
ModelTrainer.train()                BaselineLinearModelTrainer (M2B): real batch gradient
        ↓                            descent minimizing MSE, or MockModelTrainer (M2A):
        ↓                            deterministic average-of-labels baseline
serializeModel() → computeChecksum() → ModelRegistry.register()
        ↓
buildPredictor(model) → runEvaluation()   (M2B) runs the resulting Predictor over the
                                            validation split, scores it with a ModelEvaluator
```

`normalizeFeatureVector()`/`computeFeatureStats()` (min-max, fit-on-train/apply-everywhere) and
`validateFeatureVector()` (throws on malformed shape, same "fail loud" convention as v2's
`NORMALIZERS` registry) remain available as pipeline building blocks from M2A, not yet wired into
`runFusionV3Pipeline()` itself — `BaselineLinearModelTrainer` trains directly on
`MockDatasetBuilder`/`ProductionDatasetBuilder` output today, since both already produce
roughly-`[0,1]`-scaled values.

"Training may use mock data" per M2A/M2B's explicit scope — `loadMockDataset(count)` and
`MockDatasetBuilder` generate deterministic fixture `TrainingSample`s (seeded, not
`Math.random()`), so pipeline tests stay reproducible. **No production model is trained**: run
`pnpm --filter @speedora/worker pipeline:fusion-v3` against the real database and it reports 0
usable samples honestly and exits — `--mock` shows a full real run against synthetic data instead.

## Inference pipeline

`Predictor.predict(vector: FeatureVector): Promise<PredictionResult>`. Two implementations exist:
`MockPredictor` (M2A, wraps real v2 `computeHighlightScore` when given a `FusionInput` fixture) and
`BaselineLinearPredictor` (M2B, `score = dot(weights, values) + bias` from a trained
`LinearRegressionModel` — throws if the given vector's `featureNames` don't match what the model was
trained on, same "fail loud on shape mismatch" convention as the rest of this pipeline). The v2/v3
selection point a future milestone would add — "which `Predictor` implementation gets called, gated
by `isFusionV3Enabled()`" — is still not built, since no `Predictor` here is validated against real
engagement data yet. `render-clip.worker.ts` (the only real caller of v2's
`computeHighlightScore`/`rankClips`) is untouched.

## Model versioning

`ModelMetadata` (`packages/contracts/src/fusion-ml.ts`) fields, given by explicit user direction:

| Field | Type | Notes |
|---|---|---|
| `modelId` | `string` | e.g. `"mock-baseline"` |
| `modelVersion` | `string` | not assumed to sort lexically/numerically/semver |
| `createdAt` | `string` (ISO) | |
| `datasetVersion` | `string` | which Milestone 1 dataset snapshot this was trained on |
| `featureVersion` | `string` | which `FUSION_V3_SIGNALS` ordering/shape this was trained on |
| `trainingSampleCount` | `number` | |
| `evaluationScore` | `number \| null` | set by a `ModelEvaluator`, not the trainer itself |
| `checksum` | `string` | real sha256 of the serialized model (`computeChecksum`) |

**`datasetVersion`/`featureVersion` are now real (M2B), not placeholder strings.**
`computeDatasetVersion(samples)` (`packages/fusion-ml/src/dataset/dataset-versioning.ts`) sorts
samples by `sampleId` (order-independent) and checksums the set — the same content always produces
the same `versionId` (the checksum's first 12 hex chars), any change to which samples or their
labels produces a different one. `computeFeatureVersion(featureNames)`
(`packages/fusion-ml/src/feature-registry.ts`) does the same for the observed feature-name list, but
order-*sensitive* — `featureNames`' order is itself meaningful (it's what `FeatureVector.values` is
positionally aligned to), so a reorder really is a different schema. Both registered via
`FeatureRegistry`/`ModelRegistry` inside `runFusionV3Pipeline()`, not computed by the trainer itself.

**No real storage backing yet.** `ModelRegistry`/`FeatureRegistry` are both interface +
`InMemory*` implementations (`Map`s, used in tests and by `run-fusion-v3-pipeline.ts`).
`packages/storage` (S3-compatible, MinIO dev/R2 prod) has no prefix-listing API today, and no
existing "pure computation" package touches it — building a real S3-backed registry now would be
exactly the "abstraction for a scenario that can't happen yet" `docs/coding-standards.md` says to
avoid, since there's still no real trained model worth persisting across runs. When Milestone 2C
actually trains something meant to be reused, the intended production key convention is:

```
fusion/v{version}/model.bin
fusion/v{version}/metadata.json
```

matching the `models/fusion/v1/v2/v3/` layout given by explicit user direction.

## Rollback strategy

Today, "rollback" is trivial: v2 is the only engine that runs, full stop — there's nothing to roll
back *from*. Once a future milestone wires a real `Predictor` behind `isFusionV3Enabled()`:

- The flag itself is the first rollback lever — flipping `FUSION_ENGINE_V3_ENABLED` back to `false`
  (or unset) reverts every call site to v2 without a deploy, since it's read lazily at call time, not
  cached at boot.
- `ModelRegistry.list()` keeps every registered version, never overwrites — pinning a specific
  `modelVersion` (rather than always taking `getLatest()`) is a rollback that doesn't even require
  touching the flag, just which version an adapter asks the registry for.
- `checksum` lets a rollback (or a fresh deploy) verify the model artifact it just loaded is the one
  it thinks it is, not silently corrupted.

## Evaluation metrics

`packages/fusion-ml/src/evaluation/metrics.ts` — real implementations, generic over any ranking/
relevance data (not tied to v2/v3 or to a specific dataset), unit-tested against hand-computed
fixtures:

- **Precision@K** — of the top K ranked items, what fraction are relevant. Divides by
  `min(k, ranked.length)`, not a bare `k`, so a short ranked list isn't unfairly penalized.
- **Recall@K** — of every relevant item, what fraction appear in the top K. `0` (not `NaN`) when the
  relevant set is empty.
- **Spearman Rank Correlation** — computed over the *intersection* of two rankings, with items
  re-ranked relative to each other within that intersection (not their raw position in the original,
  possibly-longer list) — an earlier bug in this implementation used raw positions directly and
  produced wrong correlations whenever the two rankings didn't share the exact same membership; fixed
  before this milestone shipped (see `metrics.spec.ts`'s "computes over the intersection" case).
- **NDCG@K** — rewards relevant items appearing *earlier*, not just present somewhere in the top K.
  A highly-relevant item ranked outside the top K correctly drags NDCG down (both by missing the DCG
  numerator and by inflating the ideal-DCG denominator) — this is correct NDCG semantics, not a bug,
  even though it can look surprising at first (see `metrics.spec.ts`'s "penalizes a highly-relevant
  item" case).

`compare-engines.ts`'s `compareEngines(resultsA, resultsB, relevant?, k?)` wraps all four metrics
into one comparison of any two `RankingResult`s. `relevant` is optional — Spearman needs no ground
truth (it only compares the two rankings to each other), while Precision/Recall/NDCG need one.
Works today comparing v2's real `rankClips()` output (wrapped as a `RankingResult`) against
`MockPredictor`'s output — the closest thing to "compare v2 vs v3" possible before v3 has a real
model.

**M2B: `runEvaluation()`** (`packages/fusion-ml/src/evaluation/evaluation-runner.ts`) is the
real orchestrator wiring a `Predictor` and a `ModelEvaluator` together — runs `predictor.predict()`
over every sample in a batch, then hands the predictions + the samples' own labels to
`evaluator.evaluate()`. No new math (that's `metrics.ts`'s job); this is what
`runFusionV3Pipeline()` actually calls after training, against the held-out validation split.

## Baseline Linear Model

`packages/fusion-ml/src/baseline/linear-regression.ts` — the "Baseline Linear Model Adapter"
(Milestone 2B): real batch gradient descent minimizing MSE (`learningRate = 0.1`,
`epochs = 500` by default), not a placeholder. `BaselineLinearModelTrainer` requires every sample to
share the same `featureVector.featureNames` in the same order (throws otherwise — a linear model's
weights are positionally aligned to a fixed feature ordering, so a mismatch would silently produce a
meaningless model rather than a training that actually failed). Verified against a noiseless
synthetic dataset (`label = 3*x0 + 2*x1 + 1`) — learned weights/bias converge to within 0.1 of the
true values at the default epoch count. This is the model `run-fusion-v3-pipeline.ts` actually
trains (on mock data via `--mock`, or on real data once production has enough).
