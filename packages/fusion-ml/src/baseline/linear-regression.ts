import type { FeatureVector, ModelMetadata, PredictionResult, TrainingSample } from '@speedora/contracts';
import { computeChecksum } from '../model-registry';
import { serializeModel } from '../model-serialization';
import type { ModelTrainer, Predictor } from '../interfaces';

export interface LinearRegressionModel {
  type: 'linear-regression';
  modelVersion: string;
  weights: number[];
  bias: number;
  featureNames: string[];
}

export interface LinearRegressionConfig {
  learningRate?: number;
  epochs?: number;
  modelVersion?: string;
  datasetVersion?: string;
  featureVersion?: string;
}

const DEFAULT_LEARNING_RATE = 0.1;
const DEFAULT_EPOCHS = 500;

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function sameFeatureNames(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

// The Baseline Linear Model Adapter (Milestone 2B) - real batch gradient
// descent minimizing MSE, not a placeholder. Every sample must share the
// same featureVector.featureNames, in the same order (throws otherwise -
// same "fail loud on shape mismatch" convention as
// dataset/feature-schema-validation.ts) - a linear model's weights are
// positionally aligned to a fixed feature ordering, so a mismatch would
// silently produce a meaningless model rather than a training that
// actually failed.
export class BaselineLinearModelTrainer implements ModelTrainer {
  async train(
    samples: TrainingSample[],
    config: LinearRegressionConfig = {},
  ): Promise<{ model: unknown; metadata: ModelMetadata }> {
    if (samples.length === 0) {
      throw new Error('BaselineLinearModelTrainer requires at least one training sample');
    }
    const featureNames = samples[0].featureVector.featureNames;
    for (const sample of samples) {
      if (!sameFeatureNames(sample.featureVector.featureNames, featureNames)) {
        throw new Error(
          `Sample "${sample.sampleId}" has different featureNames than the first sample - ` +
            'every sample must share the same feature schema to train a linear model.',
        );
      }
    }

    const learningRate = config.learningRate ?? DEFAULT_LEARNING_RATE;
    const epochs = config.epochs ?? DEFAULT_EPOCHS;
    const n = samples.length;
    const dims = featureNames.length;

    const weights = new Array<number>(dims).fill(0);
    let bias = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradW = new Array<number>(dims).fill(0);
      let gradB = 0;
      for (const sample of samples) {
        const error = dot(weights, sample.featureVector.values) + bias - sample.label;
        for (let j = 0; j < dims; j++) gradW[j] += error * sample.featureVector.values[j];
        gradB += error;
      }
      const scale = (2 * learningRate) / n;
      for (let j = 0; j < dims; j++) weights[j] -= scale * gradW[j];
      bias -= scale * gradB;
    }

    const model: LinearRegressionModel = {
      type: 'linear-regression',
      modelVersion: config.modelVersion ?? `linear-${samples.length}-samples`,
      weights,
      bias,
      featureNames,
    };
    const serialized = serializeModel(model);

    const metadata: ModelMetadata = {
      modelId: 'baseline-linear-regression',
      modelVersion: model.modelVersion,
      createdAt: new Date().toISOString(),
      datasetVersion: config.datasetVersion ?? 'unknown',
      featureVersion: config.featureVersion ?? 'unknown',
      trainingSampleCount: samples.length,
      evaluationScore: null,
      checksum: computeChecksum(serialized),
    };

    return { model, metadata };
  }
}

// Turns a trained LinearRegressionModel back into a Predictor - the
// ModelTrainer's `model` output is deliberately opaque (interfaces.ts), so
// only code that knows it trained a LinearRegressionModel (this file, or
// pipeline.ts's caller-supplied `buildPredictor`) can do this cast safely.
export class BaselineLinearPredictor implements Predictor {
  constructor(private readonly model: LinearRegressionModel) {}

  async predict(vector: FeatureVector): Promise<PredictionResult> {
    if (!sameFeatureNames(vector.featureNames, this.model.featureNames)) {
      throw new Error(
        "FeatureVector's featureNames do not match the trained model's featureNames - " +
          'a linear model can only score vectors built against the same feature schema it was trained on.',
      );
    }
    return {
      clipId: vector.clipId,
      score: dot(this.model.weights, vector.values) + this.model.bias,
      confidence: null,
      modelVersion: this.model.modelVersion,
    };
  }
}
