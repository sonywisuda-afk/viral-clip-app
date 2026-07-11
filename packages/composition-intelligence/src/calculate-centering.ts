import type { CompositionSample } from '@speedora/contracts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// The farthest a point in a [0, 1] x [0, 1] frame can be from the true
// center (0.5, 0.5) is a corner - sqrt(0.5^2 + 0.5^2) = sqrt(0.5) - used to
// normalize a raw distance into a [0, 1] score. A geometric fact about the
// unit square, not a tuned threshold.
const MAX_DISTANCE_FROM_CENTER = Math.sqrt(0.5);

// Batch RB-1 - mean distance of the primary subject's bounding-box center
// from true frame-center, normalized [0, 1] (1 = dead center). The
// simplest of the four placement scores, and deliberately NOT blended with
// calculateRuleOfThirdsScore even though a well-composed off-center
// subject scores high on one and low on the other by design - keeping
// both separate lets a caller tell "centered" apart from "well-composed
// but intentionally off-center" (see docs/ai/composition-intelligence.md).
// Same exclusion/null convention as calculateRuleOfThirdsScore: frames
// with no subject are excluded, not scored 0; null when zero samples ever
// had a subjectBox.
export function calculateCenteringScore(samples: CompositionSample[]): number | null {
  const scores: number[] = [];
  for (const sample of samples) {
    if (!sample.subjectBox) continue;
    const distance = Math.hypot(sample.subjectBox.xCenter - 0.5, sample.subjectBox.yCenter - 0.5);
    scores.push(1 - clamp01(distance / MAX_DISTANCE_FROM_CENTER));
  }
  if (scores.length === 0) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}
