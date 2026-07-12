import { loadMockDataset } from '../dataset/dataset-loader';
import { computeChecksum } from '../model-registry';
import { serializeModel } from '../model-serialization';
import { MockModelTrainer } from './mock-model-trainer';

describe('MockModelTrainer', () => {
  it('trains a deterministic average-of-labels baseline', async () => {
    const samples = loadMockDataset(5);
    const trainer = new MockModelTrainer();

    const { model, metadata } = await trainer.train(samples);

    const expectedAverage = samples.reduce((sum, s) => sum + s.label, 0) / samples.length;
    expect(model).toEqual({ type: 'mock-baseline-average', average: expectedAverage });
    expect(metadata.trainingSampleCount).toBe(5);
    expect(metadata.evaluationScore).toBeNull();
  });

  it('is deterministic given the same samples', async () => {
    const samples = loadMockDataset(5);
    const trainer = new MockModelTrainer();

    const runA = await trainer.train(samples);
    const runB = await trainer.train(samples);

    expect(runA.model).toEqual(runB.model);
  });

  it('produces a checksum that matches computeChecksum(serializeModel(model))', async () => {
    const samples = loadMockDataset(3);
    const trainer = new MockModelTrainer();

    const { model, metadata } = await trainer.train(samples);

    expect(metadata.checksum).toBe(computeChecksum(serializeModel(model)));
  });

  it('uses config overrides for modelVersion/datasetVersion/featureVersion', async () => {
    const trainer = new MockModelTrainer();

    const { metadata } = await trainer.train(loadMockDataset(1), {
      modelVersion: 'v3.0.0-test',
      datasetVersion: 'ds-42',
      featureVersion: 'fv-7',
    });

    expect(metadata.modelVersion).toBe('v3.0.0-test');
    expect(metadata.datasetVersion).toBe('ds-42');
    expect(metadata.featureVersion).toBe('fv-7');
  });

  it('handles zero samples without dividing by zero', async () => {
    const trainer = new MockModelTrainer();
    const { model, metadata } = await trainer.train([]);

    expect(model).toEqual({ type: 'mock-baseline-average', average: 0 });
    expect(metadata.trainingSampleCount).toBe(0);
  });
});
