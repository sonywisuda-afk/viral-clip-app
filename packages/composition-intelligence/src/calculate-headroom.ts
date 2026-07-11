import type { CompositionSample } from '@speedora/contracts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export type FrameSize = { width: number; height: number } | null;

// Target range for "space above the subject's head" as a fraction of frame
// height (subjectBox uses a top-left-origin, y-increases-downward
// convention, same as every other normalized box in this pipeline - see
// face-landmarks.ts's boundingBox). Reasonable, uncalibrated guesses, same
// "kejujuran skala" honesty as every other threshold in this pipeline -
// portrait gets a distinct, slightly larger target range than
// landscape/neutral, per compositionInputSchema.frameSize's documented
// purpose (aspect-ratio-aware thresholds), NOT because it's been validated
// against real footage.
const HEADROOM_TARGET_MIN = 0.05;
const HEADROOM_TARGET_MAX = 0.15;
const HEADROOM_TARGET_MIN_PORTRAIT = 0.08;
const HEADROOM_TARGET_MAX_PORTRAIT = 0.2;
// Deviation from the target range beyond which the score bottoms out at 0.
const HEADROOM_MAX_DEVIATION = 0.2;

function isPortrait(frameSize: FrameSize): boolean {
  return frameSize !== null && frameSize.height > frameSize.width;
}

// 1 inside [min, max], decaying linearly to 0 as the value moves
// maxDeviation or further past whichever bound it's on the wrong side of.
function scoreAgainstRange(value: number, min: number, max: number, maxDeviation: number): number {
  if (value >= min && value <= max) return 1;
  const deviation = value < min ? min - value : value - max;
  return 1 - clamp01(deviation / maxDeviation);
}

// Batch RB-1 - mean score for space above the subject's bounding box
// (frame top to the box's own top edge), scored against a target range
// rather than a single ideal value - too little headroom reads as
// cramped, too much reads as the subject sitting too small in frame. Uses
// compositionInputSchema.frameSize (when available) to pick a portrait- or
// landscape-appropriate target range, exactly the "aspect-ratio-aware
// thresholds" use case that field was added for - see docs/ai/
// composition-intelligence.md's "What's next" section. Falls back to the
// landscape/neutral range when frameSize is null (degrades to
// orientation-agnostic, not a failure). Same exclusion/null convention as
// calculateRuleOfThirdsScore: frames with no subject are excluded, not
// scored 0; null when zero samples ever had a subjectBox.
export function calculateHeadroomScore(
  samples: CompositionSample[],
  frameSize: FrameSize = null,
): number | null {
  const [min, max] = isPortrait(frameSize)
    ? [HEADROOM_TARGET_MIN_PORTRAIT, HEADROOM_TARGET_MAX_PORTRAIT]
    : [HEADROOM_TARGET_MIN, HEADROOM_TARGET_MAX];

  const scores: number[] = [];
  for (const sample of samples) {
    if (!sample.subjectBox) continue;
    const topEdge = sample.subjectBox.yCenter - sample.subjectBox.height / 2;
    // A box extending above the frame's own top edge (topEdge < 0) reads
    // as zero headroom, not a negative one - there is no "more cramped
    // than zero space".
    scores.push(scoreAgainstRange(Math.max(topEdge, 0), min, max, HEADROOM_MAX_DEVIATION));
  }
  if (scores.length === 0) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}
