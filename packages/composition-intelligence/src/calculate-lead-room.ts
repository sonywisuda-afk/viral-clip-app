import type { CompositionSample } from '@speedora/contracts';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreAgainstRange(value: number, min: number, max: number, maxDeviation: number): number {
  if (value >= min && value <= max) return 1;
  const deviation = value < min ? min - value : value - max;
  return 1 - clamp01(deviation / maxDeviation);
}

// Target range for "space in front of the subject", as a fraction of
// frame width - reasonable, uncalibrated guesses, same "kejujuran skala"
// honesty as every other threshold in this pipeline.
const LEAD_ROOM_TARGET_MIN = 0.1;
const LEAD_ROOM_TARGET_MAX = 0.3;
const LEAD_ROOM_MAX_DEVIATION = 0.3;
// Below this |yaw| (degrees), the subject reads as facing roughly straight
// at the camera - no clear left/right heading to apply lead room toward,
// so the frame is excluded rather than guessing a direction.
const YAW_NEUTRAL_THRESHOLD_DEGREES = 15;
// How many trailing subjectBox-present samples the motion-trend fallback
// looks back across when facingYaw isn't available.
const MOTION_FALLBACK_WINDOW = 3;
// Net horizontal displacement (normalized frame widths) below which the
// motion-trend fallback also has no clear direction to report.
const MOTION_NEUTRAL_THRESHOLD = 0.02;

type PresentSample = CompositionSample & {
  subjectBox: NonNullable<CompositionSample['subjectBox']>;
};

function isPresent(sample: CompositionSample): sample is PresentSample {
  return sample.subjectBox !== null;
}

// Sign convention (positive facingYaw = facing right) mirrors this
// pipeline's faceRotationSchema convention as directly as a single-axis
// reading allows - unverified against real footage, same caveat scene-
// intelligence's classifyDirection() carries for its own dx/dy sign
// convention.
function directionFromYaw(yaw: number): 'left' | 'right' | null {
  if (Math.abs(yaw) < YAW_NEUTRAL_THRESHOLD_DEGREES) return null;
  return yaw > 0 ? 'right' : 'left';
}

// Fallback when facingYaw is unavailable (see compositionSampleSchema.
// facingYaw's own contract comment) - net horizontal displacement of the
// subjectBox center across the trailing MOTION_FALLBACK_WINDOW
// subjectBox-present samples, read as a facing-direction proxy (a subject
// drifting rightward is assumed to be moving toward whatever it's
// heading, same "best available proxy, not a real gaze/pose reading"
// honesty as facingYaw itself carries).
function directionFromMotionTrend(
  present: PresentSample[],
  index: number,
): 'left' | 'right' | null {
  const windowStart = Math.max(0, index - MOTION_FALLBACK_WINDOW);
  if (windowStart >= index) return null;
  const delta = present[index].subjectBox.xCenter - present[windowStart].subjectBox.xCenter;
  if (Math.abs(delta) < MOTION_NEUTRAL_THRESHOLD) return null;
  return delta > 0 ? 'right' : 'left';
}

// Batch RB-1 - mean score for space in the direction the subject is
// facing (compositionSampleSchema.facingYaw - HEADING, not motion
// direction, see that field's own contract comment for why yaw is the
// proxy used), falling back to the subjectBox's own recent horizontal
// displacement trend when facingYaw isn't available. Frames with no
// subject, AND frames with no resolvable direction either way (facing the
// camera head-on, or too little motion history to guess a trend), are
// excluded, not scored 0 or guessed - same "no reading, not a penalty"
// convention every RB-1 feature uses. Null when zero samples produced a
// resolvable direction.
export function calculateLeadRoomScore(samples: CompositionSample[]): number | null {
  const present = samples.filter(isPresent);

  const scores: number[] = [];
  for (let i = 0; i < present.length; i++) {
    const sample = present[i];
    const direction =
      sample.facingYaw !== null
        ? directionFromYaw(sample.facingYaw)
        : directionFromMotionTrend(present, i);
    if (direction === null) continue;

    const leadRoomValue =
      direction === 'right'
        ? 1 - (sample.subjectBox.xCenter + sample.subjectBox.width / 2)
        : sample.subjectBox.xCenter - sample.subjectBox.width / 2;

    scores.push(
      scoreAgainstRange(
        Math.max(leadRoomValue, 0),
        LEAD_ROOM_TARGET_MIN,
        LEAD_ROOM_TARGET_MAX,
        LEAD_ROOM_MAX_DEVIATION,
      ),
    );
  }

  if (scores.length === 0) return null;
  return average(scores);
}
