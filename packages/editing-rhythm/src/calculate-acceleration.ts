import type { MotionEnergySample } from '@speedora/contracts';

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Symmetric relative difference between two nonnegative quantities a
// (first half of the clip) and b (second half): -1 (all concentrated in
// the first half) to 1 (all in the second half), 0 when evenly split.
// Null when both are zero - nothing to compare on either side.
function balance(a: number, b: number): number | null {
  const total = a + b;
  if (total === 0) return null;
  return (b - a) / total;
}

// Whether a clip's cuts/motion energy are concentrated toward the start or
// the end - a proxy for a "building"/accelerating edit (activity
// concentrated later) vs. a decelerating one (activity concentrated
// earlier). Combines a cut-count-based balance and a motion-energy-based
// balance, averaging whichever of the two are computable; null when
// NEITHER can be computed (e.g. zero cuts and zero/one-sided motion
// samples).
export function calculateAcceleration(
  clipDurationSeconds: number,
  sceneCuts: number[],
  motionEnergySamples: MotionEnergySample[],
): number | null {
  if (clipDurationSeconds <= 0) return null;
  const midpoint = clipDurationSeconds / 2;

  const cutBalance = balance(
    sceneCuts.filter((t) => t < midpoint).length,
    sceneCuts.filter((t) => t >= midpoint).length,
  );

  const firstHalfMotion = motionEnergySamples
    .filter((sample) => sample.t < midpoint)
    .map((sample) => sample.motionEnergy);
  const secondHalfMotion = motionEnergySamples
    .filter((sample) => sample.t >= midpoint)
    .map((sample) => sample.motionEnergy);
  const motionBalance =
    firstHalfMotion.length > 0 && secondHalfMotion.length > 0
      ? balance(average(firstHalfMotion), average(secondHalfMotion))
      : null;

  const components = [cutBalance, motionBalance].filter((value): value is number => value !== null);
  if (components.length === 0) return null;
  return components.reduce((sum, value) => sum + value, 0) / components.length;
}
