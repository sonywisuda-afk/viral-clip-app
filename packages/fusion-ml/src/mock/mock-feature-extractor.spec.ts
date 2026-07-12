import { FUSION_V3_SIGNALS } from '@speedora/contracts';
import { MockFeatureExtractor } from './mock-feature-extractor';

describe('MockFeatureExtractor', () => {
  it('returns a FeatureVector with one value per FUSION_V3_SIGNALS entry, all in [0, 1]', async () => {
    const extractor = new MockFeatureExtractor();
    const vector = await extractor.extract('clip-1');

    expect(vector.clipId).toBe('clip-1');
    expect(vector.featureNames).toEqual([...FUSION_V3_SIGNALS]);
    expect(vector.values).toHaveLength(FUSION_V3_SIGNALS.length);
    for (const v of vector.values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same clipId', async () => {
    const extractor = new MockFeatureExtractor();
    const a = await extractor.extract('clip-1');
    const b = await extractor.extract('clip-1');
    expect(a.values).toEqual(b.values);
  });

  it('produces different values for different clipIds', async () => {
    const extractor = new MockFeatureExtractor();
    const a = await extractor.extract('clip-1');
    const b = await extractor.extract('clip-2');
    expect(a.values).not.toEqual(b.values);
  });
});
