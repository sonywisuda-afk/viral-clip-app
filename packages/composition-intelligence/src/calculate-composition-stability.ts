import type { CompositionSample } from '@speedora/contracts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Same geometric constants as calculateRuleOfThirdsScore/
// calculateCenteringScore, redeclared locally rather than imported - this
// file only needs a per-SAMPLE placement reading (not those files'
// clip-wide averages), so it stays self-contained rather than depending on
// their internals.
const THIRDS_POINTS: Array<{ x: number; y: number }> = [
  { x: 1 / 3, y: 1 / 3 },
  { x: 2 / 3, y: 1 / 3 },
  { x: 1 / 3, y: 2 / 3 },
  { x: 2 / 3, y: 2 / 3 },
];
const MAX_DISTANCE_TO_THIRDS_POINT = Math.sqrt(2) / 3;
const MAX_DISTANCE_FROM_CENTER = Math.sqrt(0.5);

// A single frame's placement reading - the average of its thirds-closeness
// and centering-closeness scores. Deliberately built from ONLY these two
// (not headroom/leadRoom) - thirds/centering are always computable for
// any frame with a subjectBox, while headroom/leadRoom can be excluded
// per-frame (target-range/direction not resolvable), which would leave
// gaps in the delta sequence below rather than a clean frame-to-frame
// comparison.
function placementScore(box: NonNullable<CompositionSample['subjectBox']>): number {
  let nearestThirds = Infinity;
  for (const point of THIRDS_POINTS) {
    const distance = Math.hypot(box.xCenter - point.x, box.yCenter - point.y);
    if (distance < nearestThirds) nearestThirds = distance;
  }
  const thirds = 1 - clamp01(nearestThirds / MAX_DISTANCE_TO_THIRDS_POINT);
  const centering =
    1 - clamp01(Math.hypot(box.xCenter - 0.5, box.yCenter - 0.5) / MAX_DISTANCE_FROM_CENTER);
  return (thirds + centering) / 2;
}

// Batch RB-1 - computed from FRAME-TO-FRAME CHANGES in composition, not
// absolute composition values (see docs/ai/composition-intelligence.md).
// This is the whole reason it's a delta rather than a variance of the raw
// score: a clip with placementScore readings of [0.8, 0.8, 0.8] and one
// with [0.6, 1.0, 0.6, 1.0] average to the identical 0.8, yet the second
// is visibly worse framing (oscillating rather than held) - only the
// frame-to-frame delta tells them apart. A raw, UNBOUNDED magnitude
// (higher = MORE oscillation/less stable), deliberately not inverted into
// a [0, 1] "stability" reading - same "raw semantics, invert later if
// needed" convention as @speedora/object-intelligence's occlusionScore.
// Only consecutive ARRAY entries that both have a subjectBox contribute a
// delta (no skipping across a gap to the next present frame) - null when
// fewer than one such adjacent pair exists.
export function calculateCompositionStability(samples: CompositionSample[]): number | null {
  const deltas: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    if (!previous.subjectBox || !current.subjectBox) continue;
    deltas.push(Math.abs(placementScore(current.subjectBox) - placementScore(previous.subjectBox)));
  }
  if (deltas.length === 0) return null;
  return average(deltas);
}
