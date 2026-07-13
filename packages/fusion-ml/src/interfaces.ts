import type {
  FeatureVector,
  ModelMetadata,
  PredictionResult,
  TrainingSample,
} from '@speedora/contracts';

// Milestone 2A (Fusion Engine v3 Foundation) - see docs/ai/fusion-v3.md.
// Every interface below has exactly one concrete mock/baseline
// implementation in src/mock/ - a bare interface has nothing to unit-test
// directly (docs/testing.md's convention only covers testing a module's
// logic or an adapter's orchestration, both of which need a real body to
// run). Each follows ARCHITECTURE.md's stateless-module shape,
// `(input, deps?) => Promise<Output>`, so a future real implementation can
// take injected dependencies (a real ML runtime, a storage client) instead
// of reaching into `process.env`/`__dirname` itself.

// Turns one clip's already-computed AI signals into a dense FeatureVector.
// A real implementation would bridge apps/worker's per-clip Fusion Engine
// v2 columns (or Milestone 1.5's DatasetRecord shape) into this contract -
// packages/fusion-ml cannot import from apps/worker, so that bridge is an
// adapter's job, not this interface's.
export interface FeatureExtractor {
  extract(clipId: string, deps?: unknown): Promise<FeatureVector>;
}

// Turns a list of sample ids into full TrainingSamples (FeatureVector +
// label). Analogous to Milestone 1.5's loadUsableSamples()
// (apps/worker/src/scripts/dataset-lib.ts), generalized to not assume a
// Prisma-backed source.
export interface DatasetBuilder {
  build(sampleIds: string[], deps?: unknown): Promise<TrainingSample[]>;
}

// Fits a model against training samples and returns both the model itself
// (opaque - this interface deliberately doesn't constrain what a "model"
// is, since a real one might be a GBT booster, a linear model, or anything
// else) and its ModelMetadata for registration.
export interface ModelTrainer {
  train(
    samples: TrainingSample[],
    config?: unknown,
  ): Promise<{ model: unknown; metadata: ModelMetadata }>;
}

// Scores a batch of predictions against ground truth, returning named
// metrics (e.g. { precisionAt10: 0.6, ndcg: 0.8 }) - deliberately a plain
// Record rather than a fixed shape, so new metrics (src/evaluation/metrics.ts)
// can be added without a contract change.
export interface ModelEvaluator {
  evaluate(
    predictions: PredictionResult[],
    groundTruth: TrainingSample[],
  ): Promise<Record<string, number>>;
}

// Runs inference for one already-extracted FeatureVector. The v2/v3
// selection point a future milestone would add (behind isFusionV3Enabled())
// is exactly "which Predictor implementation gets called here" - not built
// in this milestone, since there's no real Predictor to select yet.
export interface Predictor {
  predict(vector: FeatureVector): Promise<PredictionResult>;
}
