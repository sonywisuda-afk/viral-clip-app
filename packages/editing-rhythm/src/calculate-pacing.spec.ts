import { calculatePacing } from './calculate-pacing';

describe('calculatePacing', () => {
  it('returns null when there are fewer than two cuts', () => {
    expect(calculatePacing([5], 30)).toBeNull();
    expect(calculatePacing([], 30)).toBeNull();
  });

  it('returns null when the clip has zero duration', () => {
    expect(calculatePacing([5, 10], 0)).toBeNull();
  });

  it('returns 1 for perfectly evenly-spaced cuts', () => {
    // Cuts at 10/20 in a 30s clip -> three 10s segments, zero variance.
    const result = calculatePacing([10, 20], 30);
    expect(result).toBe(1);
  });

  it('returns a lower score for irregularly-spaced cuts than for evenly-spaced ones', () => {
    const even = calculatePacing([10, 20], 30);
    const irregular = calculatePacing([2, 28], 30);
    expect(irregular).toBeLessThan(even!);
  });

  it('is insensitive to the order cuts are supplied in (sorts internally)', () => {
    const sorted = calculatePacing([10, 20], 30);
    const unsorted = calculatePacing([20, 10], 30);
    expect(unsorted).toBe(sorted);
  });
});
