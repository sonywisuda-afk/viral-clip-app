import type { PlatformFitWeights } from '@speedora/contracts';

// Publishing Expansion Phase 7A (AI SEO - Platform-Fit Recommendation).
// Injectable (see computePlatformFit's own `weights` parameter), same
// "collect first, calibrate later" pattern as @speedora/thumbnail-selection's
// DEFAULT_THUMBNAIL_WEIGHTS and @speedora/fusion-engine's own weights.ts.
//
// Same explicit deviation @speedora/thumbnail-selection's weights.ts calls
// out: these ship as non-zero hand-authored heuristics from day one, not
// starting at 0 pending calibration - a platform-fit feature where every
// weight starts at 0 would rank every clip identically (all zeros), which
// is strictly worse than no feature at all. Each platform's weights are
// derived from that platform's typical content style (short punchy hooks
// for TikTok, professional/authoritative tone for LinkedIn, etc.), not from
// any engagement data - unvalidated, and an explicit `Open` item for future
// calibration once real per-platform engagement data exists, same posture
// as every other heuristic weight table in this codebase (see
// docs/ai/llm.md's "never presented as trained/calibrated predictions").
//
// Every vector's non-zero weights sum to 1 - verified in
// compute-platform-fit.spec.ts, not enforced at the type level (same as
// thumbnailWeightsSchema/fusion-engine's weights, which are also plain
// records with no sum-to-1 constraint in the schema itself).
export const DEFAULT_PLATFORM_FIT_WEIGHTS: PlatformFitWeights = {
  // Short, punchy, high-retention hooks; trend/curiosity-driven.
  TIKTOK: {
    hookStrength: 0.3,
    curiosity: 0.25,
    emotion: 0.15,
    storytelling: 0.15,
    novelty: 0.15,
  },
  // Emotionally resonant, visually-led storytelling.
  INSTAGRAM: {
    emotion: 0.25,
    storytelling: 0.25,
    hookStrength: 0.2,
    curiosity: 0.15,
    novelty: 0.15,
  },
  // Broader/older audience, community-oriented storytelling with a trust
  // component Instagram's weighting doesn't carry.
  FACEBOOK: {
    storytelling: 0.25,
    emotion: 0.2,
    trustAuthority: 0.2,
    hookStrength: 0.15,
    educationalValue: 0.2,
  },
  // Text-first conversation platform - curiosity/discussion-driven.
  THREADS: {
    curiosity: 0.3,
    storytelling: 0.2,
    hookStrength: 0.2,
    novelty: 0.15,
    emotion: 0.15,
  },
  // Longer-form, educational/practical, authority-driven.
  YOUTUBE: {
    educationalValue: 0.25,
    practicalValue: 0.2,
    trustAuthority: 0.2,
    storytelling: 0.15,
    novelty: 0.1,
    hookStrength: 0.1,
  },
  // Professional network - authority and practical/educational value drive
  // engagement more than pure hook strength; ctaStrength matters for lead-gen.
  LINKEDIN: {
    trustAuthority: 0.3,
    educationalValue: 0.25,
    practicalValue: 0.2,
    ctaStrength: 0.15,
    storytelling: 0.1,
  },
  // Practical, how-to, save-for-later inspiration content.
  PINTEREST: {
    practicalValue: 0.3,
    novelty: 0.25,
    educationalValue: 0.2,
    trustAuthority: 0.15,
    emotion: 0.1,
  },
  // Conversational, hot-take/CTA-driven (links, replies).
  X: {
    curiosity: 0.25,
    ctaStrength: 0.2,
    hookStrength: 0.2,
    novelty: 0.2,
    storytelling: 0.15,
  },
};
