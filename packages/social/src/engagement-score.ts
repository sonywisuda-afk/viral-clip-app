export interface EngagementStats {
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
}

// Heuristic, unvalidated - same "scale honesty" caveat as editingRhythm's
// Fusion Engine weight (see docs/ai/fusion.md). Comments/shares are weighted
// higher than a passive like as stronger engagement signals. Revisit once
// Milestone 1's own dataset (export-training-dataset.ts) has enough samples
// to check whether this actually correlates with anything.
export function computeEngagementScore(stats: EngagementStats): number | null {
  if (!stats.viewCount) return null;
  const weighted =
    (stats.likeCount ?? 0) + (stats.commentCount ?? 0) * 3 + (stats.shareCount ?? 0) * 5;
  return weighted / stats.viewCount;
}
