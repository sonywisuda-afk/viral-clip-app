import type { RankingResult } from '@speedora/contracts';
import { ndcg, precisionAtK, recallAtK, spearmanCorrelation } from './metrics';

export interface EngineComparison {
  modelVersionA: string;
  modelVersionB: string;
  spearman: number;
  precisionAtK: number | null;
  recallAtK: number | null;
  ndcg: number | null;
}

// Generic over any two RankingResults - "must support future datasets"
// means this isn't hardcoded to v2 vs v3; it works today comparing v2's
// real rankClips() output (wrapped as a RankingResult) against any other
// ranking, mock or real. `relevant` (a ground-truth relevant-item set) is
// optional because it isn't always available - Spearman correlation
// between the two rankings themselves needs no ground truth at all, only
// precision/recall/NDCG do.
export function compareEngines(
  resultsA: RankingResult,
  resultsB: RankingResult,
  relevant?: Set<string>,
  k = 10,
): EngineComparison {
  const orderedA = [...resultsA.rankings].sort((x, y) => x.rank - y.rank).map((r) => r.clipId);
  const orderedB = [...resultsB.rankings].sort((x, y) => x.rank - y.rank).map((r) => r.clipId);

  const spearman = spearmanCorrelation(orderedA, orderedB);

  let precisionAtKValue: number | null = null;
  let recallAtKValue: number | null = null;
  let ndcgValue: number | null = null;
  if (relevant) {
    precisionAtKValue = precisionAtK(orderedB, relevant, k);
    recallAtKValue = recallAtK(orderedB, relevant, k);
    ndcgValue = ndcg(
      resultsB.rankings.map((r) => ({
        clipId: r.clipId,
        relevance: relevant.has(r.clipId) ? 1 : 0,
      })),
      k,
    );
  }

  return {
    modelVersionA: resultsA.modelVersion,
    modelVersionB: resultsB.modelVersion,
    spearman,
    precisionAtK: precisionAtKValue,
    recallAtK: recallAtKValue,
    ndcg: ndcgValue,
  };
}
