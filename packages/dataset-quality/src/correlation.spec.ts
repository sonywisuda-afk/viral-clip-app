import { pearsonCorrelation } from './correlation';

describe('pearsonCorrelation', () => {
  it('returns 1 for a perfectly positively correlated pair', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
  });

  it('returns -1 for a perfectly negatively correlated pair', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  });

  it('skips pairs where either value is null (pairwise-complete)', () => {
    const result = pearsonCorrelation([1, 2, null, 4], [10, 20, 999, 40]);
    expect(result).toBeCloseTo(1);
  });

  it('returns null when fewer than 2 complete pairs exist', () => {
    expect(pearsonCorrelation([1, null, null], [10, null, null])).toBeNull();
  });

  it('returns null when one variable has zero variance', () => {
    expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBeNull();
  });
});
