import { ndcg, precisionAtK, recallAtK, spearmanCorrelation } from './metrics';

describe('precisionAtK', () => {
  it('computes precision over the top K', () => {
    expect(precisionAtK(['a', 'b', 'c', 'd'], new Set(['a', 'c']), 2)).toBe(0.5);
  });

  it('is 1 when every top-K item is relevant', () => {
    expect(precisionAtK(['a', 'b'], new Set(['a', 'b']), 2)).toBe(1);
  });

  it('is 0 when no top-K item is relevant', () => {
    expect(precisionAtK(['a', 'b'], new Set(['z']), 2)).toBe(0);
  });

  it('divides by the ranked length, not k, when the list is shorter than k', () => {
    expect(precisionAtK(['a'], new Set(['a']), 5)).toBe(1);
  });

  it('is 0 for k <= 0 or an empty ranked list', () => {
    expect(precisionAtK(['a'], new Set(['a']), 0)).toBe(0);
    expect(precisionAtK([], new Set(['a']), 3)).toBe(0);
  });
});

describe('recallAtK', () => {
  it('computes recall over the top K', () => {
    expect(recallAtK(['a', 'b', 'c', 'd'], new Set(['a', 'c']), 2)).toBe(0.5);
  });

  it('is 1 when every relevant item appears in the top K', () => {
    expect(recallAtK(['a', 'b', 'c'], new Set(['a', 'c']), 3)).toBe(1);
  });

  it('is 0 when relevant is empty', () => {
    expect(recallAtK(['a', 'b'], new Set(), 2)).toBe(0);
  });
});

describe('spearmanCorrelation', () => {
  it('is 1 for identical orderings', () => {
    expect(spearmanCorrelation(['a', 'b', 'c'], ['a', 'b', 'c'])).toBeCloseTo(1);
  });

  it('is -1 for completely reversed orderings', () => {
    expect(spearmanCorrelation(['a', 'b', 'c'], ['c', 'b', 'a'])).toBeCloseTo(-1);
  });

  it('computes over the intersection when the two rankings differ in membership', () => {
    // Shared items a,b,c keep their relative order in both -> perfect correlation,
    // even though B has an extra item 'z' A doesn't have.
    expect(spearmanCorrelation(['a', 'b', 'c'], ['a', 'z', 'b', 'c'])).toBeCloseTo(1);
  });

  it('is 0 when fewer than 2 items are shared', () => {
    expect(spearmanCorrelation(['a'], ['a'])).toBe(0);
    expect(spearmanCorrelation(['a', 'b'], ['c', 'd'])).toBe(0);
  });
});

describe('ndcg', () => {
  it('is 1 for an already-ideal ranking', () => {
    const ranked = [
      { clipId: 'a', relevance: 3 },
      { clipId: 'b', relevance: 2 },
      { clipId: 'c', relevance: 1 },
    ];
    expect(ndcg(ranked, 3)).toBeCloseTo(1);
  });

  it('is less than 1 for a worst-case (ascending relevance) ranking', () => {
    const ranked = [
      { clipId: 'a', relevance: 1 },
      { clipId: 'b', relevance: 2 },
      { clipId: 'c', relevance: 3 },
    ];
    expect(ndcg(ranked, 3)).toBeCloseTo(0.79, 2);
  });

  it('is 0 when every relevance is 0', () => {
    const ranked = [
      { clipId: 'a', relevance: 0 },
      { clipId: 'b', relevance: 0 },
    ];
    expect(ndcg(ranked, 2)).toBe(0);
  });

  it('penalizes a highly-relevant item that got ranked outside the top K', () => {
    // 'c' has the highest relevance by far but sits outside the top-1
    // window - ideal-@1 would have picked 'c', so ndcg correctly comes out
    // very low even though 'a' (the actual top-1 pick) is reasonably
    // relevant on its own.
    const ranked = [
      { clipId: 'a', relevance: 3 },
      { clipId: 'b', relevance: 2 },
      { clipId: 'c', relevance: 1000 },
    ];
    expect(ndcg(ranked, 1)).toBeCloseTo(0.003, 3);
  });
});
