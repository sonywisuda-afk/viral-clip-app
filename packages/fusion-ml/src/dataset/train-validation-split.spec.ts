import { loadMockDataset } from './dataset-loader';
import { splitTrainValidation } from './train-validation-split';

describe('splitTrainValidation', () => {
  it('splits 10 samples at a 0.2 ratio into 8 train / 2 validation', () => {
    const samples = loadMockDataset(10);
    const { train, validation } = splitTrainValidation(samples, 0.2);
    expect(train).toHaveLength(8);
    expect(validation).toHaveLength(2);
  });

  it('every sample appears in exactly one of train/validation', () => {
    const samples = loadMockDataset(10);
    const { train, validation } = splitTrainValidation(samples, 0.3);
    const combined = new Set([...train, ...validation].map((s) => s.sampleId));
    expect(combined.size).toBe(10);
  });

  it('a ratio of 0 puts everything in train', () => {
    const samples = loadMockDataset(5);
    const { train, validation } = splitTrainValidation(samples, 0);
    expect(train).toHaveLength(5);
    expect(validation).toHaveLength(0);
  });

  it('throws for a ratio outside [0, 1)', () => {
    const samples = loadMockDataset(5);
    expect(() => splitTrainValidation(samples, 1)).toThrow();
    expect(() => splitTrainValidation(samples, -0.1)).toThrow();
  });
});
