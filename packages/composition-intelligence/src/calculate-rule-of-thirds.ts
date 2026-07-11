import type { CompositionSample } from '@speedora/contracts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// The four rule-of-thirds gridline intersections in normalized [0, 1]
// frame space (verticals at x = 1/3, 2/3; horizontals at y = 1/3, 2/3).
const THIRDS_POINTS: Array<{ x: number; y: number }> = [
  { x: 1 / 3, y: 1 / 3 },
  { x: 2 / 3, y: 1 / 3 },
  { x: 1 / 3, y: 2 / 3 },
  { x: 2 / 3, y: 2 / 3 },
];

// The farthest any point in a [0, 1] x [0, 1] frame can be from its
// NEAREST thirds intersection is a corner (e.g. (0, 0) -> nearest point
// (1/3, 1/3)) - sqrt(2)/3, used to normalize a raw distance into a [0, 1]
// closeness score. A geometric fact about the unit square, not a tuned
// threshold.
const MAX_DISTANCE_TO_THIRDS_POINT = Math.sqrt(2) / 3;

function distanceToNearestThirdsPoint(xCenter: number, yCenter: number): number {
  let nearest = Infinity;
  for (const point of THIRDS_POINTS) {
    const distance = Math.hypot(xCenter - point.x, yCenter - point.y);
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}

// Batch RB-1 - mean closeness of the primary subject's bounding-box center
// to the nearest rule-of-thirds intersection point, across samples WITH a
// subjectBox. Frames with no subject are EXCLUDED, not scored 0 - a true
// "no reading" rather than a framing penalty, same convention every other
// RB-1 feature below uses. Null when zero samples ever had a subjectBox.
export function calculateRuleOfThirdsScore(samples: CompositionSample[]): number | null {
  const scores: number[] = [];
  for (const sample of samples) {
    if (!sample.subjectBox) continue;
    const distance = distanceToNearestThirdsPoint(
      sample.subjectBox.xCenter,
      sample.subjectBox.yCenter,
    );
    scores.push(1 - clamp01(distance / MAX_DISTANCE_TO_THIRDS_POINT));
  }
  if (scores.length === 0) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}
