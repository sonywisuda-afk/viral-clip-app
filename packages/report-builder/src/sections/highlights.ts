import type { HighlightSection, ReportClipInput, TopMomentsSection } from '@speedora/contracts';

export function buildHighlightSection(clips: ReportClipInput[]): HighlightSection {
  return {
    entries: clips.map((clip) => ({
      clipId: clip.id,
      highlightScore: clip.highlightScore,
      highlightConfidence: clip.highlightConfidence,
      highlightReason: clip.highlightReason,
      breakdown: clip.highlightBreakdown,
      topFactors: clip.highlightTopFactors,
      prediction: clip.highlightPrediction,
      recommendation: clip.highlightRecommendation,
      highlightRank: clip.highlightRank,
    })),
  };
}

const DEFAULT_TOP_MOMENTS_LIMIT = 5;

// Ranked by highlightRank (already computed per-video by render-clip.worker.ts's
// rankClips() - lower is better, same convention as Fusion Engine v2) when
// present; a clip missing a rank (not yet ranked, or ranking never ran) sorts
// after every ranked clip, ordered by raw highlightScore instead so a video
// with partial ranking still gets a sensible Top Moments list rather than an
// arbitrary one.
export function buildTopMomentsSection(
  clips: ReportClipInput[],
  limit: number = DEFAULT_TOP_MOMENTS_LIMIT,
): TopMomentsSection {
  const sorted = [...clips].sort((a, b) => {
    if (a.highlightRank !== null && b.highlightRank !== null) {
      return a.highlightRank - b.highlightRank;
    }
    if (a.highlightRank !== null) return -1;
    if (b.highlightRank !== null) return 1;
    return (b.highlightScore ?? -Infinity) - (a.highlightScore ?? -Infinity);
  });

  return {
    moments: sorted.slice(0, limit).map((clip) => ({
      clipId: clip.id,
      hookText: clip.hookText,
      thumbnailUrl: clip.thumbnailUrl,
      highlightScore: clip.highlightScore,
      highlightRank: clip.highlightRank,
    })),
  };
}
