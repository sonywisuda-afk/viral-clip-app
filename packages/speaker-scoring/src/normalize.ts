// Speaker Intelligence roadmap, Milestone C. Same cap VALUES as
// @speedora/fusion-engine's own feature-pipeline.ts NORMALIZERS
// (AUDIO_QUIET_DB/AUDIO_LOUD_DB/SPEAKING_RATE_STD_DEV_CAP/
// HEAD_MOVEMENT_RATE_CAP), duplicated rather than imported - this package
// deliberately has no dependency on @speedora/fusion-engine (that package
// is expected to depend on THIS one once Milestone D wires a `speaker`
// signal in, so the reverse dependency would risk a cycle). Kept in sync
// by convention, same "small cross-package literal duplication" precedent
// used throughout this pipeline (see @speedora/active-speaker-intelligence's
// mouth-activity.ts).
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

const AUDIO_QUIET_DB = -40;
const AUDIO_LOUD_DB = -10;
const SPEAKING_RATE_STD_DEV_CAP = 2;
const HEAD_MOVEMENT_RATE_CAP = 30;
// Not one of fusion-engine's existing caps (that pipeline has never needed
// a "how active is this speaking pace" reading, only pacing VARIABILITY
// via speakingRateStdDev) - a reasonable guess at a fast-but-plausible
// words/sec rate, unvalidated against real footage, same honesty as every
// other cap in this pipeline.
const SPEAKING_RATE_ACTIVITY_CAP = 4;

export function voiceEnergyScore(averageRmsDb: number): number {
  return clamp(mapRange(averageRmsDb, AUDIO_QUIET_DB, AUDIO_LOUD_DB, 0, 1), 0, 1);
}

// Inverted (1 - normalized stddev): a STEADIER pace reads as more
// confident/stable, the opposite direction from fusion-engine's own
// speakingRateStdDev normalizer (which treats higher variability as more
// "dynamic," neither better nor worse) - this package is answering a
// different question ("how steady/confident") than the Fusion Engine's
// highlightScore ("how engaging"), so the same raw signal is legitimately
// read in opposite directions by the two.
export function voiceStabilityScore(speakingRateStdDev: number): number {
  return clamp(1 - mapRange(speakingRateStdDev, 0, SPEAKING_RATE_STD_DEV_CAP, 0, 1), 0, 1);
}

export function speakingActivityScore(averageSpeakingRateWordsPerSecond: number): number {
  return clamp(averageSpeakingRateWordsPerSecond / SPEAKING_RATE_ACTIVITY_CAP, 0, 1);
}

// Inverted, same reasoning as voiceStabilityScore - a STEADIER head reads
// as more confident/attentive.
export function headPoseStabilityScore(averageHeadMovementRate: number): number {
  return clamp(1 - mapRange(averageHeadMovementRate, 0, HEAD_MOVEMENT_RATE_CAP, 0, 1), 0, 1);
}

// Averages whichever of the given [0,1]-or-null component scores are
// actually present - the shared "overallScore"/"score" rollup rule used by
// every scoring function in this package. null when NONE of the components
// were available (not a fabricated 0/50).
export function averageAvailable(components: Array<number | null>): number | null {
  const present = components.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}
