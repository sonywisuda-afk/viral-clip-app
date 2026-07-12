// Offline evaluation framework (Milestone 2A) - "must support future
// datasets" means every function here is generic over plain ids/relevance
// scores, never tied to a specific dataset shape. No production model
// required to exercise these; see compare-engines.ts for how they're used
// to compare two RankingResults (v2 vs a future v3, or any two rankings).

// Precision@K: of the top K ranked items, what fraction are relevant.
// Divides by min(k, ranked.length) rather than a bare k, so a ranked list
// shorter than k isn't unfairly penalized for items that were never ranked
// at all.
export function precisionAtK(ranked: string[], relevant: Set<string>, k: number): number {
  if (k <= 0) return 0;
  const top = ranked.slice(0, k);
  const denominator = Math.min(k, ranked.length);
  if (denominator === 0) return 0;
  const hits = top.filter((id) => relevant.has(id)).length;
  return hits / denominator;
}

// Recall@K: of every relevant item, what fraction appear in the top K.
// Returns 0 (not NaN) when `relevant` is empty - "nothing to recall" is a
// defined 0, not an undefined 0/0.
export function recallAtK(ranked: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0 || k <= 0) return 0;
  const top = ranked.slice(0, k);
  const hits = top.filter((id) => relevant.has(id)).length;
  return hits / relevant.size;
}

// Spearman rank correlation between two orderings of (at least partially)
// the same items. Computed over the INTERSECTION of the two rankings, not
// their union - a ranking framework "supporting future datasets" can't
// assume every id appears in both. Returns 0 for fewer than 2 shared items
// (correlation is undefined, not "no correlation," but 0 is the honest
// "insufficient data" signal this codebase's other calibration tooling
// already uses - see apps/worker/src/scripts/dataset-quality.ts).
export function spearmanCorrelation(rankingA: string[], rankingB: string[]): number {
  const positionA = new Map(rankingA.map((id, i) => [id, i]));
  const positionB = new Map(rankingB.map((id, i) => [id, i]));
  const shared = rankingA.filter((id) => positionB.has(id));
  const n = shared.length;
  if (n < 2) return 0;

  // Re-rank the shared items relative to EACH OTHER within each list,
  // rather than using their raw index in the original (possibly longer)
  // list - an item preceded by non-shared items in one list shouldn't be
  // penalized for that gap, only for its order relative to the other
  // shared items.
  const relativeRankA = new Map(
    [...shared].sort((x, y) => positionA.get(x)! - positionA.get(y)!).map((id, i) => [id, i]),
  );
  const relativeRankB = new Map(
    [...shared].sort((x, y) => positionB.get(x)! - positionB.get(y)!).map((id, i) => [id, i]),
  );

  const sumSquaredDiff = shared.reduce((sum, id) => {
    const d = relativeRankA.get(id)! - relativeRankB.get(id)!;
    return sum + d * d;
  }, 0);
  return 1 - (6 * sumSquaredDiff) / (n * (n * n - 1));
}

// NDCG@K (Normalized Discounted Cumulative Gain) - rewards relevant items
// appearing EARLIER in the ranking, not just present somewhere in the top
// K (unlike precision/recall, which treat every position in the top K
// equally). Returns 0 when the ideal DCG is 0 (no relevance signal at all),
// not NaN.
export function ndcg(ranked: Array<{ clipId: string; relevance: number }>, k: number): number {
  const top = ranked.slice(0, k);
  const dcg = top.reduce((sum, item, i) => sum + item.relevance / Math.log2(i + 2), 0);

  const ideal = [...ranked].sort((a, b) => b.relevance - a.relevance).slice(0, k);
  const idcg = ideal.reduce((sum, item, i) => sum + item.relevance / Math.log2(i + 2), 0);

  if (idcg === 0) return 0;
  return dcg / idcg;
}
