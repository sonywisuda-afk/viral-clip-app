// Below this many cuts, "regularity of spacing" isn't a meaningful question
// (a variance across just two segments is a weak signal) - same "not
// enough data" honesty as every other minimum-sample-count gate in this
// pipeline (e.g. @speedora/facial-intelligence's stability requiring 2+
// classified samples).
const MIN_CUTS_FOR_PACING = 2;

// Coefficient-of-variation-based regularity of cut spacing across the
// clip. Segments are the gaps a clip's cuts divide it into (including the
// segment before the first cut and after the last, same convention as
// @speedora/scene-intelligence's averageSegmentSeconds) - 1 means every
// segment is the same length (CV=0, perfectly even pacing), approaching 0
// as segment lengths vary more (CV grows). Null when there are too few
// cuts to compute a meaningful variance, or the clip has zero duration.
export function calculatePacing(sceneCuts: number[], clipDurationSeconds: number): number | null {
  if (clipDurationSeconds <= 0 || sceneCuts.length < MIN_CUTS_FOR_PACING) return null;

  const sorted = [...sceneCuts].sort((a, b) => a - b);
  const boundaries = [0, ...sorted, clipDurationSeconds];
  const segments: number[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    segments.push(boundaries[i] - boundaries[i - 1]);
  }

  const mean = segments.reduce((sum, value) => sum + value, 0) / segments.length;
  if (mean === 0) return null;
  const variance = segments.reduce((sum, value) => sum + (value - mean) ** 2, 0) / segments.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  // 1 / (1 + CV) maps [0, ∞) to (0, 1] - CV=0 (perfectly even) -> 1,
  // larger CV (more irregular) asymptotically approaches 0. A reasonable,
  // bounded transform, not calibrated against real footage.
  return 1 / (1 + coefficientOfVariation);
}
