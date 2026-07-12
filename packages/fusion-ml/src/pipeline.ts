import type { DatasetVersion, FeatureSchema, ModelMetadata } from '@speedora/contracts';
import { computeDatasetVersion } from './dataset/dataset-versioning';
import { splitTrainValidation } from './dataset/train-validation-split';
import type { EvaluationReport } from './evaluation/evaluation-runner';
import { runEvaluation } from './evaluation/evaluation-runner';
import { computeFeatureVersion, type FeatureRegistry } from './feature-registry';
import type { DatasetBuilder, ModelEvaluator, ModelTrainer, Predictor } from './interfaces';
import type { ModelRegistry } from './model-registry';

export interface PipelineResult {
  datasetVersion: DatasetVersion;
  featureSchema: FeatureSchema;
  modelMetadata: ModelMetadata;
  evaluationReport: EvaluationReport;
}

export interface PipelineOptions {
  datasetBuilder: DatasetBuilder;
  sampleIds: string[];
  trainer: ModelTrainer;
  // ModelTrainer's `model` output is deliberately opaque (interfaces.ts) -
  // only the caller, who knows which trainer it used, can turn it back
  // into a Predictor. e.g. `(model) => new BaselineLinearPredictor(model as LinearRegressionModel)`.
  buildPredictor: (model: unknown) => Predictor;
  evaluator: ModelEvaluator;
  modelRegistry: ModelRegistry;
  featureRegistry: FeatureRegistry;
  validationRatio?: number;
  trainConfig?: unknown;
}

const DEFAULT_VALIDATION_RATIO = 0.2;

// Milestone 2B's End-to-End Pipeline Verification - the real orchestrator
// tying every M2A/M2B piece together: build -> version the dataset ->
// register the feature schema -> split -> train -> register the model ->
// evaluate on the held-out validation split. Pure (no DB access itself -
// `datasetBuilder` is injected, same as every other dependency here), so
// it's exercised end-to-end by pipeline.spec.ts using mock/in-memory
// implementations, and reused as-is by apps/worker's
// run-fusion-v3-pipeline.ts script with real (or --mock) implementations
// injected instead.
export async function runFusionV3Pipeline(options: PipelineOptions): Promise<PipelineResult> {
  const samples = await options.datasetBuilder.build(options.sampleIds);
  if (samples.length === 0) {
    throw new Error(
      'runFusionV3Pipeline: datasetBuilder.build() returned 0 samples - nothing to train on.',
    );
  }

  const datasetVersion = computeDatasetVersion(samples);

  const featureNames = samples[0].featureVector.featureNames;
  const featureVersion = computeFeatureVersion(featureNames);
  const featureSchema: FeatureSchema = {
    featureVersion,
    featureNames,
    createdAt: new Date().toISOString(),
  };
  await options.featureRegistry.register(featureSchema);

  const validationRatio = options.validationRatio ?? DEFAULT_VALIDATION_RATIO;
  const { train, validation } = splitTrainValidation(samples, validationRatio);

  // The orchestrator is the source of truth for dataset/feature versioning,
  // not the injected ModelTrainer - datasetVersion/featureVersion on the
  // final metadata always reflect what THIS run actually used, regardless
  // of whether a given trainer implementation bothers to read/set them
  // itself (both MockModelTrainer and BaselineLinearModelTrainer do, but a
  // future third trainer isn't required to).
  const { model, metadata: trainedMetadata } = await options.trainer.train(train, options.trainConfig);
  const modelMetadata: ModelMetadata = {
    ...trainedMetadata,
    datasetVersion: datasetVersion.versionId,
    featureVersion,
  };
  await options.modelRegistry.register(model, modelMetadata);

  const predictor = options.buildPredictor(model);
  const evaluationSet = validation.length > 0 ? validation : train;
  const evaluationReport = await runEvaluation(predictor, options.evaluator, evaluationSet);

  return { datasetVersion, featureSchema, modelMetadata, evaluationReport };
}
