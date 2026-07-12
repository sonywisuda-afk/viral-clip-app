import type { FeatureVector } from '@speedora/contracts';
import { computeFeatureStats, normalizeFeatureVector } from './feature-normalization';

function vector(values: number[]): FeatureVector {
  return { clipId: 'c1', featureNames: values.map((_, i) => `f${i}`), values, extractedAt: '2026-01-01T00:00:00.000Z' };
}

describe('normalizeFeatureVector', () => {
  it('maps a value at min to 0 and at max to 1', () => {
    const result = normalizeFeatureVector(vector([0, 10]), [
      { min: 0, max: 20 },
      { min: 0, max: 10 },
    ]);
    expect(result.values).toEqual([0, 1]);
  });

  it('maps the midpoint to 0.5', () => {
    const result = normalizeFeatureVector(vector([5]), [{ min: 0, max: 10 }]);
    expect(result.values).toEqual([0.5]);
  });

  it('maps a constant feature (min === max) to 0.5, not NaN', () => {
    const result = normalizeFeatureVector(vector([7]), [{ min: 7, max: 7 }]);
    expect(result.values).toEqual([0.5]);
  });

  it('throws when stats length does not match values length', () => {
    expect(() => normalizeFeatureVector(vector([1, 2]), [{ min: 0, max: 1 }])).toThrow();
  });

  it('preserves clipId/featureNames/extractedAt', () => {
    const result = normalizeFeatureVector(vector([5]), [{ min: 0, max: 10 }]);
    expect(result.clipId).toBe('c1');
    expect(result.featureNames).toEqual(['f0']);
    expect(result.extractedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('computeFeatureStats', () => {
  it('returns empty array for no vectors', () => {
    expect(computeFeatureStats([])).toEqual([]);
  });

  it('computes per-feature min/max across vectors', () => {
    const stats = computeFeatureStats([vector([1, 10]), vector([5, 2]), vector([3, 8])]);
    expect(stats).toEqual([
      { min: 1, max: 5 },
      { min: 2, max: 10 },
    ]);
  });
});
