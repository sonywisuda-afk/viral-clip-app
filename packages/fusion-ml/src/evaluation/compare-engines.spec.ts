import type { RankingResult } from '@speedora/contracts';
import { compareEngines } from './compare-engines';

function ranking(modelVersion: string, clipIds: string[]): RankingResult {
  return {
    modelVersion,
    rankings: clipIds.map((clipId, i) => ({ clipId, rank: i + 1, score: clipIds.length - i })),
  };
}

describe('compareEngines', () => {
  it('reports spearman 1 and null precision/recall/ndcg when no relevant set is given', () => {
    const a = ranking('v2', ['x', 'y', 'z']);
    const b = ranking('v3-mock', ['x', 'y', 'z']);

    const result = compareEngines(a, b);

    expect(result.modelVersionA).toBe('v2');
    expect(result.modelVersionB).toBe('v3-mock');
    expect(result.spearman).toBeCloseTo(1);
    expect(result.precisionAtK).toBeNull();
    expect(result.recallAtK).toBeNull();
    expect(result.ndcg).toBeNull();
  });

  it('reports -1 spearman for completely reversed rankings', () => {
    const a = ranking('v2', ['x', 'y', 'z']);
    const b = ranking('v3-mock', ['z', 'y', 'x']);

    expect(compareEngines(a, b).spearman).toBeCloseTo(-1);
  });

  it('computes precision/recall/ndcg against a ground-truth relevant set', () => {
    const a = ranking('v2', ['x', 'y', 'z']);
    const b = ranking('v3-mock', ['x', 'y', 'z']);
    const relevant = new Set(['x', 'z']);

    const result = compareEngines(a, b, relevant, 2);

    // top-2 of B is [x, y]: 1 of 2 relevant present.
    expect(result.precisionAtK).toBe(0.5);
    // 1 of 2 relevant items (x) found in top-2.
    expect(result.recallAtK).toBe(0.5);
    expect(result.ndcg).toBeGreaterThan(0);
    expect(result.ndcg).toBeLessThanOrEqual(1);
  });
});
