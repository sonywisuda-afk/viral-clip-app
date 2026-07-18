import {
  CLIP_SCORE_DIMENSIONS,
  SOCIAL_PLATFORMS,
  type ClipScores,
  type PlatformFitResult,
  type PlatformFitScore,
  type PlatformFitWeights,
} from '@speedora/contracts';
import { DEFAULT_PLATFORM_FIT_WEIGHTS } from './weights';

const TOP_DIMENSIONS_COUNT = 3;

// Publishing Expansion Phase 7A (AI SEO - Platform-Fit Recommendation). Pure
// weighted-sum over an already-computed ClipScores breakdown - no I/O, no
// LLM call. See @speedora/contracts' platform-fit.ts for the full contract
// and weights.ts for why these are hand-authored heuristic weights, not a
// trained/calibrated model.
export function computePlatformFit(
  scores: ClipScores,
  weights: PlatformFitWeights = DEFAULT_PLATFORM_FIT_WEIGHTS,
): PlatformFitResult {
  const rankings: PlatformFitScore[] = SOCIAL_PLATFORMS.map((platform) => {
    const platformWeights = weights[platform] ?? {};
    const contributions = CLIP_SCORE_DIMENSIONS.map((dimension) => {
      const weight = platformWeights[dimension] ?? 0;
      return { dimension, weight, contribution: weight * (scores[dimension] ?? 0) };
    });

    const score = contributions.reduce((sum, c) => sum + c.contribution, 0);

    // Best-to-worst (highest weighted contribution first), unlike
    // @speedora/thumbnail-selection's THUMBNAIL_SIGNALS ordering comment
    // (which orders the constant worst-to-best for readability, not this
    // array) - this is the actual runtime ranking, used for explainability.
    const topDimensions = contributions
      .filter((c) => c.weight > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, TOP_DIMENSIONS_COUNT)
      .map((c) => c.dimension);

    return {
      platform,
      score: Math.max(0, Math.min(100, score)),
      topDimensions,
    };
  });

  rankings.sort((a, b) => b.score - a.score);

  return { rankings };
}
