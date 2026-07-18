import type { ClipScores } from './video';
import type { SocialPlatform } from './social';

// Publishing Expansion Phase 7A (AI SEO - Platform-Fit Recommendation).
// Mirrors @speedora/contracts' platform-fit.ts (PlatformFitScore/
// PlatformFitResult) - duplicated rather than imported, same convention as
// ClipScores itself (see video.ts's own comment): a DB-facing package and a
// DB-agnostic contract package don't depend on each other in either
// direction, by convention rather than a shared import.
export type ClipScoreDimension = keyof ClipScores;

export interface PlatformFitScore {
  platform: SocialPlatform;
  score: number;
  topDimensions: ClipScoreDimension[];
}

export interface ClipPlatformFitDto {
  clipId: string;
  rankings: PlatformFitScore[];
}
