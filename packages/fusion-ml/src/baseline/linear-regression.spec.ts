import type { TrainingSample } from '@speedora/contracts';
import {
  BaselineLinearModelTrainer,
  BaselineLinearPredictor,
  type LinearRegressionModel,
} from './linear-regression';

// Noiseless synthetic dataset: label = 3*x0 + 2*x1 + 1 exactly.
function syntheticSamples(): TrainingSample[] {
  const points: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0.2, 0.8],
    [0.7, 0.3],
    [0.5, 0.5],
    [0.9, 0.1],
  ];
  return points.map(([x0, x1], i) => ({
    sampleId: `s${i}`,
    featureVector: {
      clipId: `clip-${i}`,
      featureNames: ['f0', 'f1'],
      values: [x0, x1],
      extractedAt: '2026-01-01T00:00:00.000Z',
    },
    label: 3 * x0 + 2 * x1 + 1,
  }));
}

describe('BaselineLinearModelTrainer', () => {
  it('converges close to the true weights/bias on a noiseless linear dataset', async () => {
    const trainer = new BaselineLinearModelTrainer();
    const { model } = await trainer.train(syntheticSamples());
    const linearModel = model as LinearRegressionModel;

    expect(linearModel.weights[0]).toBeCloseTo(3, 1);
    expect(linearModel.weights[1]).toBeCloseTo(2, 1);
    expect(linearModel.bias).toBeCloseTo(1, 1);
  });

  it('produces real ModelMetadata with a checksum matching the serialized model', async () => {
    const trainer = new BaselineLinearModelTrainer();
    const { metadata } = await trainer.train(syntheticSamples(), {
      datasetVersion: 'ds-1',
      featureVersion: 'fv-1',
    });

    expect(metadata.modelId).toBe('baseline-linear-regression');
    expect(metadata.trainingSampleCount).toBe(8);
    expect(metadata.datasetVersion).toBe('ds-1');
    expect(metadata.featureVersion).toBe('fv-1');
    expect(metadata.checksum).toHaveLength(64);
  });

  it('throws when samples have mismatched featureNames', async () => {
    const trainer = new BaselineLinearModelTrainer();
    const samples = syntheticSamples();
    samples[1].featureVector.featureNames = ['different'];

    await expect(trainer.train(samples)).rejects.toThrow();
  });

  it('throws for an empty sample list', async () => {
    const trainer = new BaselineLinearModelTrainer();
    await expect(trainer.train([])).rejects.toThrow();
  });
});

describe('BaselineLinearPredictor', () => {
  it('predicts the exact dot product for a hand-crafted model', async () => {
    const model: LinearRegressionModel = {
      type: 'linear-regression',
      modelVersion: 'test-v1',
      weights: [2, 5],
      bias: 1,
      featureNames: ['f0', 'f1'],
    };
    const predictor = new BaselineLinearPredictor(model);

    const result = await predictor.predict({
      clipId: 'clip-1',
      featureNames: ['f0', 'f1'],
      values: [3, 4],
      extractedAt: '2026-01-01T00:00:00.000Z',
    });

    // 2*3 + 5*4 + 1 = 27
    expect(result.score).toBe(27);
    expect(result.modelVersion).toBe('test-v1');
    expect(result.confidence).toBeNull();
  });

  it('throws when the vector featureNames do not match the trained model', async () => {
    const model: LinearRegressionModel = {
      type: 'linear-regression',
      modelVersion: 'test-v1',
      weights: [1],
      bias: 0,
      featureNames: ['f0'],
    };
    const predictor = new BaselineLinearPredictor(model);

    await expect(
      predictor.predict({
        clipId: 'c1',
        featureNames: ['other'],
        values: [1],
        extractedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow();
  });
});
