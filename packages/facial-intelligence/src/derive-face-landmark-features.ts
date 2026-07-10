import type {
  AffectLabel,
  FaceLandmarkFeatures,
  FaceLandmarkSample,
  LookingDirection,
} from '@speedora/contracts';

// Blendshape score above which a sampled frame counts as "eyes closed" for
// blinkRate - MediaPipe's own blendshape scale is 0-1; 0.5 is the
// conventional threshold used in MediaPipe's own blink-detection sample
// code, not a value tuned against real footage here (see the script's own
// verification caveat).
const BLINK_THRESHOLD = 0.5;

// Batch 2 (Eye Contact/Looking Direction) thresholds - both reasonable
// guesses, not calibrated against real footage, same "kejujuran skala" as
// every other threshold in this pipeline. HEAD_FORWARD_THRESHOLD_DEGREES
// gates on head rotation FIRST (a more geometrically grounded quantity,
// from the transformation matrix) - only once the head itself is roughly
// forward-facing does iris offset get to decide left/right, since a
// strongly turned head makes iris position an unreliable read on its own.
const HEAD_FORWARD_THRESHOLD_DEGREES = 20;
const GAZE_CENTER_THRESHOLD = 0.35;

// Batch 3 (Occlusion) - mouthContrastRatio below this counts as "possibly
// occluded" for this sample. The LEAST confident threshold in this whole
// module (see detect_face_landmarks.py's own caveat): a naturally still,
// closed mouth can read just as low as a hand/object covering it - this
// heuristic cannot tell the two apart. Kept deliberately conservative
// (low) so it flags only strong anomalies rather than every closed-mouth
// frame. Exported - Batch 4.5's deriveTrackingQualityMetrics() reuses the
// exact same threshold for its own faceOcclusionRatio/per-track
// occlusionRatio rather than redeclaring a second magic number that could
// drift out of sync with this one.
export const OCCLUSION_CONTRAST_THRESHOLD = 0.15;

// Batch 4 (Speaker Face Selection's "real" version) - jawOpen blendshape
// above this counts as "mouth actively moving/open" for the audio-sync
// agreement check. Same 0-1 blendshape scale as BLINK_THRESHOLD, similarly
// a reasonable guess rather than a calibrated value.
const MOUTH_ACTIVITY_THRESHOLD = 0.15;

// Batch 4 (Speaker Face Selection) - a clip-relative time window with a
// simple yes/no "is there audible speech happening" flag, supplied by the
// CALLER (render-clip.worker.ts, which already has the clip's transcript
// segments + their Fase 25 rmsDb readings in scope) rather than computed
// here - this module deliberately has no dependency on TranscriptSegment's
// shape or any dB threshold decision, same "narrow input contract" pattern
// as e.g. @speedora/clip-scoring's own ClipScoringInput.
export interface AudioActivityWindow {
  start: number;
  end: number;
  hasAudio: boolean;
}

function audioActiveAt(windows: AudioActivityWindow[], t: number): boolean | null {
  const window = windows.find((w) => t >= w.start && t < w.end);
  return window ? window.hasAudio : null;
}

// Batch 5A (Lip Activity) - a sustained run needs at least this many
// consecutive samples-with-blendshapes below MOUTH_ACTIVITY_THRESHOLD to
// count as a "pause" (roughly >= 2 seconds at the 1-sample/sec rate) - a
// reasonable guess, not calibrated against real footage, same as every
// other threshold in this pipeline. Short blips (a single low-activity
// sample between words) don't count.
const MIN_PAUSE_SAMPLES = 2;

// Batch 5B (Smile & Laugh) - thresholds for the genuineSmileRate heuristic,
// all reasonable guesses, not calibrated against real footage. A sample
// counts as "smiling" once its average mouthSmileLeft/Right crosses
// SMILE_ACTIVE_THRESHOLD; among those, cheek-raise/eye-squint ALSO need to
// cross their own thresholds for the smile to be flagged "genuine"
// (Duchenne marker) - see this module's own caveat on why this can't be a
// certain classification.
const SMILE_ACTIVE_THRESHOLD = 0.5;
const CHEEK_RAISE_THRESHOLD = 0.3;
const EYE_SQUINT_THRESHOLD = 0.3;

// Batch 5C (Blink & Eye Behavior) - a blink run needs at least this many
// consecutive samples-with-blendshapes above BLINK_THRESHOLD to count as
// "prolonged" rather than a normal blink - at this pipeline's 1-sample/sec
// rate, a real blink (~100-400ms) essentially never spans 2+ consecutive
// samples, so this doubles as "how many samples make a closure look
// sustained rather than a normal blink caught mid-frame". Reasonable
// guess, not calibrated against real footage.
const PROLONGED_CLOSURE_MIN_SAMPLES = 2;

// Typical frame-to-frame change in continuous gaze offset (see
// eyeGazeOffset below - a ratio roughly in [-1,1]) for a visually steady
// gaze; at/above this reads as "maximally wandering". Unvalidated guess,
// same as every other cap in this pipeline.
const GAZE_STABILITY_CAP = 0.5;

// Batch 5D (Emotion Heuristic) - normalization caps and decision-tree
// thresholds, all reasonable guesses, not calibrated against real
// footage, same "kejujuran skala" as every other constant in this
// pipeline. HEAD_MOVEMENT_RATE_CAP: degrees/sec of combined pitch+yaw+roll
// change at/above which head movement reads as "maximally dynamic".
const HEAD_MOVEMENT_RATE_CAP = 30;
// Component-score thresholds for dominantAffect's decision tree - checked
// in this exact priority order (see the derivation below for why).
const POSITIVE_AFFECT_THRESHOLD = 0.5;
const HIGH_ENERGY_THRESHOLD = 0.6;
const EXPRESSIVE_THRESHOLD = 0.5;
const LOW_ENERGY_THRESHOLD = 0.2;
// Same cap VALUES as @speedora/fusion-engine's own LIP_VELOCITY_CAP/
// ARTICULATION_RATE_CAP, duplicated here (not imported - separate
// packages) purely so this module's own composite energy/expressiveness
// scores can normalize these raw signals to 0-1 before combining them; the
// Fusion Engine's later normalization of the raw feature values themselves
// is a completely separate step and doesn't read these.
const LIP_VELOCITY_NORM_CAP = 0.5;
const ARTICULATION_RATE_NORM_CAP = 2;

// Per-eye horizontal iris offset from the eye socket's own center, as a
// fraction of half the eye's width - both eyes' landmarks are already in
// the SAME image-space coordinate frame (not mirrored/anatomical), so no
// left/right sign-flip is needed before averaging the two eyes together.
// Returns null when the eye has zero measured width (degenerate/failed
// landmark read) rather than dividing by zero.
function eyeGazeOffset(
  iris: { x: number },
  innerCorner: { x: number },
  outerCorner: { x: number },
): number | null {
  const eyeCenterX = (innerCorner.x + outerCorner.x) / 2;
  const halfEyeWidth = Math.abs(outerCorner.x - innerCorner.x) / 2;
  if (halfEyeWidth === 0) return null;
  return (iris.x - eyeCenterX) / halfEyeWidth;
}

// Batch 5C (Gaze Stability) - the SAME per-eye offset eyeGazeOffset()
// computes above, averaged across whichever eye(s) have valid landmarks,
// but read CONTINUOUSLY here rather than fed into lookingDirectionFor's
// head-rotation-gated bucket decision - gaze stability cares about raw
// frame-to-frame wobble, not the discrete center/left/right/up/down
// classification. Returns null when neither eye has valid gaze landmarks.
function continuousGazeOffsetFor(sample: FaceLandmarkSample): number | null {
  const offsets: number[] = [];
  if (sample.leftIris && sample.leftEyeInnerCorner && sample.leftEyeOuterCorner) {
    const offset = eyeGazeOffset(sample.leftIris, sample.leftEyeInnerCorner, sample.leftEyeOuterCorner);
    if (offset !== null) offsets.push(offset);
  }
  if (sample.rightIris && sample.rightEyeInnerCorner && sample.rightEyeOuterCorner) {
    const offset = eyeGazeOffset(
      sample.rightIris,
      sample.rightEyeInnerCorner,
      sample.rightEyeOuterCorner,
    );
    if (offset !== null) offsets.push(offset);
  }
  return offsets.length === 0 ? null : offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
}

// Step: per-sample looking-direction bucket - head rotation takes priority
// over iris offset (see module comment above). Returns null when the
// sample is missing any of the landmarks this needs (should only happen
// for a sample with no face at all, given every field here comes from the
// same MediaPipe call).
function lookingDirectionFor(sample: FaceLandmarkSample): LookingDirection | null {
  if (
    !sample.rotation ||
    !sample.leftIris ||
    !sample.rightIris ||
    !sample.leftEyeInnerCorner ||
    !sample.leftEyeOuterCorner ||
    !sample.rightEyeInnerCorner ||
    !sample.rightEyeOuterCorner
  ) {
    return null;
  }

  if (Math.abs(sample.rotation.yaw) > HEAD_FORWARD_THRESHOLD_DEGREES) {
    return sample.rotation.yaw > 0 ? 'right' : 'left';
  }
  if (Math.abs(sample.rotation.pitch) > HEAD_FORWARD_THRESHOLD_DEGREES) {
    return sample.rotation.pitch > 0 ? 'down' : 'up';
  }

  const leftGaze = eyeGazeOffset(sample.leftIris, sample.leftEyeInnerCorner, sample.leftEyeOuterCorner);
  const rightGaze = eyeGazeOffset(
    sample.rightIris,
    sample.rightEyeInnerCorner,
    sample.rightEyeOuterCorner,
  );
  const gazeSamples = [leftGaze, rightGaze].filter((value): value is number => value !== null);
  if (gazeSamples.length === 0) return 'center';

  const averageGaze = gazeSamples.reduce((sum, value) => sum + value, 0) / gazeSamples.length;
  if (Math.abs(averageGaze) <= GAZE_CENTER_THRESHOLD) return 'center';
  return averageGaze > 0 ? 'right' : 'left';
}

// Furthest a bounding-box center can be from frame-center (0.5, 0.5) within
// the normalized [0,1] unit square - the corner distance - used to
// normalize positionScore to [0, 1] regardless of aspect ratio quirks.
const MAX_CENTER_DISTANCE = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Pure, synchronous summary derivation over detectFaceLandmarks()'s raw
// per-sample output - same "separate function, not folded into the
// subprocess-calling one" convention as deriveFacialEmotionFeatures. All
// fields null when zero samples had a detected face at all - not
// fabricated zeros/neutral values (a clip where the speaker is never in
// frame should read as "no data," not as "perfectly centered, score 0").
export function deriveFaceLandmarkFeatures(
  samples: FaceLandmarkSample[],
  audioActivity: AudioActivityWindow[] = [],
): FaceLandmarkFeatures {
  const withFace = samples.filter((sample) => sample.boundingBox !== null);

  if (withFace.length === 0) {
    return {
      blinkRate: null,
      averageSmile: null,
      averageMouthOpen: null,
      averageAbsoluteYaw: null,
      averageAbsolutePitch: null,
      positionScore: null,
      sizeScore: null,
      visibilityScore: samples.length === 0 ? null : 0,
      eyeContactRate: null,
      dominantLookingDirection: null,
      averageSharpness: null,
      averageBrightness: null,
      occlusionRate: null,
      speakerChangeCount: null,
      dominantSpeakerConsistency: null,
      speakerAudioSyncRate: null,
      averageLipVelocity: null,
      speakingIntensity: null,
      pauseCount: null,
      articulationRate: null,
      averageMouthWidth: null,
      averageCheekRaise: null,
      averageEyeSquint: null,
      genuineSmileRate: null,
      blinkFrequencyPerMinute: null,
      prolongedClosureCount: null,
      gazeStabilityScore: null,
      averageBrowActivity: null,
      averageHeadMovementRate: null,
      dominantAffect: null,
      affectConfidence: null,
    };
  }

  const withBlendshapes = withFace.filter((sample) => sample.blendshapes !== null);
  const withRotation = withFace.filter((sample) => sample.rotation !== null);

  const blinkRate =
    withBlendshapes.length === 0
      ? null
      : withBlendshapes.filter(
          (sample) =>
            Math.max(sample.blendshapes!.eyeBlinkLeft, sample.blendshapes!.eyeBlinkRight) >=
            BLINK_THRESHOLD,
        ).length / withBlendshapes.length;

  const averageSmile =
    withBlendshapes.length === 0
      ? null
      : withBlendshapes.reduce(
          (sum, sample) =>
            sum + (sample.blendshapes!.mouthSmileLeft + sample.blendshapes!.mouthSmileRight) / 2,
          0,
        ) / withBlendshapes.length;

  const averageMouthOpen =
    withBlendshapes.length === 0
      ? null
      : withBlendshapes.reduce((sum, sample) => sum + sample.blendshapes!.jawOpen, 0) /
        withBlendshapes.length;

  const averageAbsoluteYaw =
    withRotation.length === 0
      ? null
      : withRotation.reduce((sum, sample) => sum + Math.abs(sample.rotation!.yaw), 0) /
        withRotation.length;

  const averageAbsolutePitch =
    withRotation.length === 0
      ? null
      : withRotation.reduce((sum, sample) => sum + Math.abs(sample.rotation!.pitch), 0) /
        withRotation.length;

  const positionScore =
    withFace.reduce((sum, sample) => {
      const box = sample.boundingBox!;
      const distance = Math.sqrt((box.xCenter - 0.5) ** 2 + (box.yCenter - 0.5) ** 2);
      return sum + clamp01(1 - distance / MAX_CENTER_DISTANCE);
    }, 0) / withFace.length;

  const sizeScore =
    withFace.reduce((sum, sample) => {
      const box = sample.boundingBox!;
      return sum + clamp01(box.width * box.height);
    }, 0) / withFace.length;

  const visibilityScore = withFace.length / samples.length;

  // Batch 2 - looking direction resolved per sample-with-a-face (null for
  // one missing eye/rotation landmarks, filtered out below the same way
  // withBlendshapes/withRotation already are for other features).
  const directions = withFace
    .map(lookingDirectionFor)
    .filter((direction): direction is LookingDirection => direction !== null);

  const eyeContactRate =
    directions.length === 0
      ? null
      : directions.filter((direction) => direction === 'center').length / directions.length;

  // First-occurrence tie-break, same convention as dominantEmotion/
  // dominantGesture.
  let dominantLookingDirection: LookingDirection | null = null;
  if (directions.length > 0) {
    const counts = new Map<LookingDirection, number>();
    for (const direction of directions) counts.set(direction, (counts.get(direction) ?? 0) + 1);
    dominantLookingDirection = directions[0];
    let dominantCount = 0;
    for (const direction of directions) {
      const count = counts.get(direction) ?? 0;
      if (count > dominantCount) {
        dominantCount = count;
        dominantLookingDirection = direction;
      }
    }
  }

  // Batch 3 (Blur/Sharpness/Lighting/Occlusion) - same "average over
  // samples that actually have this measurement" pattern as blendshapes/
  // rotation above.
  const withSharpness = withFace.filter((sample) => sample.sharpness !== null);
  const averageSharpness =
    withSharpness.length === 0
      ? null
      : withSharpness.reduce((sum, sample) => sum + sample.sharpness!, 0) / withSharpness.length;

  const withBrightness = withFace.filter((sample) => sample.brightness !== null);
  const averageBrightness =
    withBrightness.length === 0
      ? null
      : withBrightness.reduce((sum, sample) => sum + sample.brightness!, 0) / withBrightness.length;

  const withMouthContrast = withFace.filter((sample) => sample.mouthContrastRatio !== null);
  const occlusionRate =
    withMouthContrast.length === 0
      ? null
      : withMouthContrast.filter(
          (sample) => sample.mouthContrastRatio! < OCCLUSION_CONTRAST_THRESHOLD,
        ).length / withMouthContrast.length;

  // Batch 4 (Face Re-identification/Tracking) - trackId sequence over
  // samples-with-a-face only (a gap where no face was found isn't itself a
  // "speaker change," it's just missing data - same reasoning as every
  // other withX filter above).
  const withTrackId = withFace.filter((sample) => sample.trackId !== null);

  let speakerChangeCount: number | null = null;
  let dominantSpeakerConsistency: number | null = null;
  if (withTrackId.length > 0) {
    speakerChangeCount = 0;
    for (let i = 1; i < withTrackId.length; i++) {
      if (withTrackId[i].trackId !== withTrackId[i - 1].trackId) speakerChangeCount++;
    }

    // Longest contiguous run of a single trackId, as a fraction of
    // withTrackId.length - deliberately the longest RUN, not the highest
    // overall count, since a track that appears in two separate bursts
    // (person leaves and returns) is a less "consistent" dominant speaker
    // than one continuous appearance of the same total length.
    let longestRun = 1;
    let currentRun = 1;
    for (let i = 1; i < withTrackId.length; i++) {
      if (withTrackId[i].trackId === withTrackId[i - 1].trackId) {
        currentRun++;
        longestRun = Math.max(longestRun, currentRun);
      } else {
        currentRun = 1;
      }
    }
    dominantSpeakerConsistency = longestRun / withTrackId.length;
  }

  // Batch 4 (Speaker Face Selection's "real" version) - null (not 0) when
  // the caller supplied no audio-timing data at all, distinct from "computed
  // but every window happened to disagree" (see this field's own schema
  // comment for why the distinction matters).
  let speakerAudioSyncRate: number | null = null;
  if (audioActivity.length > 0) {
    let agreementCount = 0;
    let evaluatedCount = 0;
    for (const sample of withBlendshapes) {
      const hasAudio = audioActiveAt(audioActivity, sample.t);
      if (hasAudio === null) continue;
      const mouthActive = sample.blendshapes!.jawOpen >= MOUTH_ACTIVITY_THRESHOLD;
      if (mouthActive === hasAudio) agreementCount++;
      evaluatedCount++;
    }
    speakerAudioSyncRate = evaluatedCount === 0 ? null : agreementCount / evaluatedCount;
  }

  // Batch 5A (Lip Activity) - all four derived from the jawOpen blendshape
  // sequence in withBlendshapes (already filtered to samples-with-a-face
  // that also have blendshapes) - "adjacent in this filtered array" is
  // treated as "consecutive" for velocity/pause/articulation purposes,
  // same simplification convention as speakerChangeCount's trackId
  // sequence above (a gap in between isn't specially handled).
  let averageLipVelocity: number | null = null;
  if (withBlendshapes.length >= 2) {
    const velocities: number[] = [];
    for (let i = 1; i < withBlendshapes.length; i++) {
      const dt = withBlendshapes[i].t - withBlendshapes[i - 1].t;
      if (dt <= 0) continue;
      const dJawOpen = Math.abs(
        withBlendshapes[i].blendshapes!.jawOpen - withBlendshapes[i - 1].blendshapes!.jawOpen,
      );
      velocities.push(dJawOpen / dt);
    }
    averageLipVelocity =
      velocities.length === 0
        ? null
        : velocities.reduce((sum, value) => sum + value, 0) / velocities.length;
  }

  const activeMouthSamples = withBlendshapes.filter(
    (sample) => sample.blendshapes!.jawOpen >= MOUTH_ACTIVITY_THRESHOLD,
  );
  const speakingIntensity =
    activeMouthSamples.length === 0
      ? null
      : activeMouthSamples.reduce((sum, sample) => sum + sample.blendshapes!.jawOpen, 0) /
        activeMouthSamples.length;

  let pauseCount: number | null = null;
  if (withBlendshapes.length > 0) {
    pauseCount = 0;
    let currentRun = 0;
    for (const sample of withBlendshapes) {
      if (sample.blendshapes!.jawOpen < MOUTH_ACTIVITY_THRESHOLD) {
        currentRun++;
      } else {
        if (currentRun >= MIN_PAUSE_SAMPLES) pauseCount++;
        currentRun = 0;
      }
    }
    if (currentRun >= MIN_PAUSE_SAMPLES) pauseCount++;
  }

  let articulationRate: number | null = null;
  if (withBlendshapes.length >= 3) {
    const duration =
      withBlendshapes[withBlendshapes.length - 1].t - withBlendshapes[0].t;
    if (duration > 0) {
      let directionChanges = 0;
      let previousDirection: 1 | -1 | null = null;
      for (let i = 1; i < withBlendshapes.length; i++) {
        const delta =
          withBlendshapes[i].blendshapes!.jawOpen - withBlendshapes[i - 1].blendshapes!.jawOpen;
        if (delta === 0) continue;
        const direction = delta > 0 ? 1 : -1;
        if (previousDirection !== null && direction !== previousDirection) directionChanges++;
        previousDirection = direction;
      }
      articulationRate = directionChanges / duration;
    }
  }

  // Batch 5B (Smile & Laugh) - averageMouthWidth from the raw mouthWidth
  // ratio (same "average over samples that have this measurement"
  // pattern as averageSharpness/averageBrightness); averageCheekRaise/
  // averageEyeSquint from the corresponding blendshape pairs, same
  // averaging pattern as averageSmile.
  const withMouthWidth = withFace.filter((sample) => sample.mouthWidth !== null);
  const averageMouthWidth =
    withMouthWidth.length === 0
      ? null
      : withMouthWidth.reduce((sum, sample) => sum + sample.mouthWidth!, 0) /
        withMouthWidth.length;

  const averageCheekRaise =
    withBlendshapes.length === 0
      ? null
      : withBlendshapes.reduce(
          (sum, sample) =>
            sum + (sample.blendshapes!.cheekSquintLeft + sample.blendshapes!.cheekSquintRight) / 2,
          0,
        ) / withBlendshapes.length;

  const averageEyeSquint =
    withBlendshapes.length === 0
      ? null
      : withBlendshapes.reduce(
          (sum, sample) =>
            sum + (sample.blendshapes!.eyeSquintLeft + sample.blendshapes!.eyeSquintRight) / 2,
          0,
        ) / withBlendshapes.length;

  // "Smiling" subset first (average mouthSmileLeft/Right above threshold),
  // then within that subset, the fraction ALSO showing both cheek-raise
  // AND eye-squint above their own thresholds - a coarse Duchenne-marker
  // heuristic, not a trained/validated classifier (see this module's own
  // caveat). Null (not 0) when no sample ever crossed the smiling
  // threshold at all.
  const smilingSamples = withBlendshapes.filter(
    (sample) =>
      (sample.blendshapes!.mouthSmileLeft + sample.blendshapes!.mouthSmileRight) / 2 >=
      SMILE_ACTIVE_THRESHOLD,
  );
  const genuineSmileRate =
    smilingSamples.length === 0
      ? null
      : smilingSamples.filter((sample) => {
          const cheekRaise =
            (sample.blendshapes!.cheekSquintLeft + sample.blendshapes!.cheekSquintRight) / 2;
          const eyeSquint =
            (sample.blendshapes!.eyeSquintLeft + sample.blendshapes!.eyeSquintRight) / 2;
          return cheekRaise >= CHEEK_RAISE_THRESHOLD && eyeSquint >= EYE_SQUINT_THRESHOLD;
        }).length / smilingSamples.length;

  // Batch 5C (Blink & Eye Behavior) - blink events/prolonged closures from
  // runs of consecutive samples-with-blendshapes above BLINK_THRESHOLD
  // (adjacent-in-filtered-array convention, same as every other run-based
  // feature in this module).
  let blinkFrequencyPerMinute: number | null = null;
  let prolongedClosureCount: number | null = null;
  if (withBlendshapes.length > 0) {
    let blinkEventCount = 0;
    prolongedClosureCount = 0;
    let inBlink = false;
    let currentRunLength = 0;
    for (const sample of withBlendshapes) {
      const isBlinking =
        Math.max(sample.blendshapes!.eyeBlinkLeft, sample.blendshapes!.eyeBlinkRight) >=
        BLINK_THRESHOLD;
      if (isBlinking) {
        if (!inBlink) {
          blinkEventCount++;
          inBlink = true;
          currentRunLength = 0;
        }
        currentRunLength++;
      } else {
        if (inBlink && currentRunLength >= PROLONGED_CLOSURE_MIN_SAMPLES) prolongedClosureCount++;
        inBlink = false;
        currentRunLength = 0;
      }
    }
    if (inBlink && currentRunLength >= PROLONGED_CLOSURE_MIN_SAMPLES) prolongedClosureCount++;

    const duration = withBlendshapes[withBlendshapes.length - 1].t - withBlendshapes[0].t;
    blinkFrequencyPerMinute =
      withBlendshapes.length >= 2 && duration > 0 ? blinkEventCount / (duration / 60) : null;
  }

  // Batch 5C (Gaze Stability) - continuous (not bucketed) gaze offset over
  // samples-with-a-face (independent of blendshapes, same as Batch 2's own
  // lookingDirectionFor input).
  const gazeOffsets = withFace
    .map((sample) => continuousGazeOffsetFor(sample))
    .filter((value): value is number => value !== null);
  let gazeStabilityScore: number | null = null;
  if (gazeOffsets.length >= 2) {
    const deltas: number[] = [];
    for (let i = 1; i < gazeOffsets.length; i++) {
      deltas.push(Math.abs(gazeOffsets[i] - gazeOffsets[i - 1]));
    }
    const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    gazeStabilityScore = clamp01(1 - averageDelta / GAZE_STABILITY_CAP);
  }

  // Batch 5D (Emotion Heuristic) - averageBrowActivity is an UNDIRECTED
  // magnitude (up + down blendshapes averaged together, not read as
  // "raised = positive") per this batch's own safety requirement.
  const averageBrowActivity =
    withBlendshapes.length === 0
      ? null
      : withBlendshapes.reduce((sum, sample) => {
          const b = sample.blendshapes!;
          return (
            sum +
            (b.browDownLeft + b.browDownRight + b.browInnerUp + b.browOuterUpLeft + b.browOuterUpRight) /
              5
          );
        }, 0) / withBlendshapes.length;

  // Same "adjacent-in-filtered-array, divide by actual elapsed time"
  // convention as averageLipVelocity (Batch 5A) - combined pitch+yaw+roll
  // change magnitude between consecutive samples-with-rotation, per second.
  let averageHeadMovementRate: number | null = null;
  if (withRotation.length >= 2) {
    const rates: number[] = [];
    for (let i = 1; i < withRotation.length; i++) {
      const dt = withRotation[i].t - withRotation[i - 1].t;
      if (dt <= 0) continue;
      const a = withRotation[i - 1].rotation!;
      const b = withRotation[i].rotation!;
      const distance = Math.sqrt(
        (b.pitch - a.pitch) ** 2 + (b.yaw - a.yaw) ** 2 + (b.roll - a.roll) ** 2,
      );
      rates.push(distance / dt);
    }
    averageHeadMovementRate =
      rates.length === 0 ? null : rates.reduce((sum, value) => sum + value, 0) / rates.length;
  }

  // dominantAffect - a simple deterministic decision tree (NOT a trained
  // classifier) over 3 component scores, checked in this exact priority
  // order: a strong smile signal wins outright ('positive_affect') before
  // energy/expressiveness get a say, since a clip that's clearly smiling
  // shouldn't be relabeled just because the speaker is also gesturing a
  // lot. High energy is checked before "expressive" (a high-energy clip is
  // definitionally also somewhat expressive, so the more specific/stronger
  // read wins). 'low_energy' only fires when energy is available AND low -
  // absence of energy data does NOT imply low energy. 'neutral' is the
  // catch-all once data exists but nothing else matched, not the default
  // for missing data (see dominantAffect: null below for that case).
  const normalizedHeadMovement =
    averageHeadMovementRate === null ? null : clamp01(averageHeadMovementRate / HEAD_MOVEMENT_RATE_CAP);
  const normalizedArticulation =
    articulationRate === null ? null : clamp01(articulationRate / ARTICULATION_RATE_NORM_CAP);
  const normalizedLipVelocity =
    averageLipVelocity === null ? null : clamp01(averageLipVelocity / LIP_VELOCITY_NORM_CAP);

  const positivityScore = averageSmile;

  const energyComponents = [speakingIntensity, averageBrowActivity, normalizedHeadMovement].filter(
    (value): value is number => value !== null,
  );
  const energyScore =
    energyComponents.length === 0
      ? null
      : energyComponents.reduce((sum, value) => sum + value, 0) / energyComponents.length;

  const expressivenessComponents = [
    averageBrowActivity,
    normalizedArticulation,
    normalizedLipVelocity,
  ].filter((value): value is number => value !== null);
  const expressivenessScore =
    expressivenessComponents.length === 0
      ? null
      : expressivenessComponents.reduce((sum, value) => sum + value, 0) /
        expressivenessComponents.length;

  let dominantAffect: AffectLabel | null = null;
  let affectConfidence: number | null = null;
  const availableComponents = [positivityScore, energyScore, expressivenessScore].filter(
    (value): value is number => value !== null,
  );
  if (availableComponents.length > 0) {
    affectConfidence = availableComponents.length / 3;
    if (positivityScore !== null && positivityScore >= POSITIVE_AFFECT_THRESHOLD) {
      dominantAffect = 'positive_affect';
    } else if (energyScore !== null && energyScore >= HIGH_ENERGY_THRESHOLD) {
      dominantAffect = 'high_energy';
    } else if (expressivenessScore !== null && expressivenessScore >= EXPRESSIVE_THRESHOLD) {
      dominantAffect = 'expressive';
    } else if (energyScore !== null && energyScore <= LOW_ENERGY_THRESHOLD) {
      dominantAffect = 'low_energy';
    } else {
      dominantAffect = 'neutral';
    }
  }

  return {
    blinkRate,
    averageSmile,
    averageMouthOpen,
    averageAbsoluteYaw,
    averageAbsolutePitch,
    positionScore,
    sizeScore,
    visibilityScore,
    eyeContactRate,
    dominantLookingDirection,
    averageSharpness,
    averageBrightness,
    occlusionRate,
    speakerChangeCount,
    dominantSpeakerConsistency,
    speakerAudioSyncRate,
    averageLipVelocity,
    speakingIntensity,
    pauseCount,
    articulationRate,
    averageMouthWidth,
    averageCheekRaise,
    averageEyeSquint,
    genuineSmileRate,
    blinkFrequencyPerMinute,
    prolongedClosureCount,
    gazeStabilityScore,
    averageBrowActivity,
    averageHeadMovementRate,
    dominantAffect,
    affectConfidence,
  };
}
