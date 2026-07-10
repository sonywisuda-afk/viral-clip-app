import type { EditingRhythmInput } from '@speedora/contracts';

// Reasonable guesses, NOT calibrated against real footage/engagement data -
// same "kejujuran skala" as every cap elsewhere in this pipeline.
// CUTS_PER_MINUTE_CAP/MOTION_ENERGY_CAP intentionally match
// @speedora/fusion-engine's own SCENE_CUTS_PER_MINUTE_CAP/MOTION_ENERGY_CAP
// (duplicated, not imported - two separate packages serving different
// purposes, same reasoning as @speedora/facial-intelligence's
// HEAD_MOVEMENT_RATE_CAP duplication in @speedora/fusion-engine).
const CUTS_PER_MINUTE_CAP = 20;
const MOTION_ENERGY_CAP = 20;
// Words/second at/above which speaking rate reads as "maximally fast" -
// energetic conversational speech is roughly 2.5-3 words/sec, so this is a
// generous upper band.
const SPEAKING_RATE_CAP = 3.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Overall speed/energy reading for a clip - a composite of whichever of
// cutsPerMinute/averageMotionEnergy/averageSpeakingRateWordsPerSecond are
// available, each normalized to [0, 1] then averaged. Null only when NONE
// of the three inputs are available, not a fabricated 0 - same "average
// whichever signals exist" pattern as @speedora/fusion-engine's own
// highlightScore computation.
export function calculateTempo(
  input: Pick<
    EditingRhythmInput,
    'cutsPerMinute' | 'averageMotionEnergy' | 'averageSpeakingRateWordsPerSecond'
  >,
): number | null {
  const components: number[] = [];
  if (input.cutsPerMinute !== null) {
    components.push(clamp01(input.cutsPerMinute / CUTS_PER_MINUTE_CAP));
  }
  if (input.averageMotionEnergy !== null) {
    components.push(clamp01(input.averageMotionEnergy / MOTION_ENERGY_CAP));
  }
  if (input.averageSpeakingRateWordsPerSecond !== null) {
    components.push(clamp01(input.averageSpeakingRateWordsPerSecond / SPEAKING_RATE_CAP));
  }
  if (components.length === 0) return null;
  return components.reduce((sum, value) => sum + value, 0) / components.length;
}
