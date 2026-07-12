import { FUSION_V3_SIGNALS } from '@speedora/contracts';
import { loadMockDataset } from './dataset-loader';

describe('loadMockDataset', () => {
  it('returns the requested number of samples', () => {
    expect(loadMockDataset(5)).toHaveLength(5);
  });

  it('returns an empty array for count 0', () => {
    expect(loadMockDataset(0)).toEqual([]);
  });

  it('each sample has one feature value per FUSION_V3_SIGNALS entry, all in [0, 1]', () => {
    const [sample] = loadMockDataset(1);
    expect(sample.featureVector.featureNames).toEqual([...FUSION_V3_SIGNALS]);
    expect(sample.featureVector.values).toHaveLength(FUSION_V3_SIGNALS.length);
    for (const v of sample.featureVector.values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic across calls', () => {
    expect(loadMockDataset(3)).toEqual(loadMockDataset(3));
  });

  it('gives distinct samples distinct clipIds and sampleIds', () => {
    const samples = loadMockDataset(3);
    const clipIds = new Set(samples.map((s) => s.featureVector.clipId));
    const sampleIds = new Set(samples.map((s) => s.sampleId));
    expect(clipIds.size).toBe(3);
    expect(sampleIds.size).toBe(3);
  });
});
