import type {
  CameraMotionFeatures,
  CameraMotionSample,
  CameraMotionType,
} from '@speedora/contracts';

// Reasonable guesses, NOT calibrated against real footage - same
// "kejujuran skala" as every other threshold in this pipeline
// (FADE_PROXIMITY_SECONDS, STATIC_DYNAMIC_THRESHOLD, etc.). ZOOM_THRESHOLD/
// PAN_TILT_THRESHOLD are fractions of frame width/height per ~1-second
// sample interval; SHAKE_DOMINANT_THRESHOLD is a fraction of consecutive-
// sample sign reversals.
const ZOOM_THRESHOLD = 0.02;
const PAN_TILT_THRESHOLD = 0.01;
const SHAKE_DOMINANT_THRESHOLD = 0.5;

type ClassifiableSample = CameraMotionSample & { dx: number; dy: number; scale: number };

function isClassifiable(sample: CameraMotionSample): sample is ClassifiableSample {
  return sample.dx !== null && sample.dy !== null && sample.scale !== null;
}

type SimpleMotionType = 'pan' | 'tilt' | 'zoom' | 'static';

// Per-sample classification - "shake" is deliberately NOT a possible result
// here (it's a multi-sample pattern - erratic direction reversal - not a
// property of one sample in isolation, computed separately below).
function classifySample(sample: ClassifiableSample): SimpleMotionType {
  const zoomMagnitude = Math.abs(sample.scale - 1);
  const panMagnitude = Math.abs(sample.dx);
  const tiltMagnitude = Math.abs(sample.dy);

  if (
    zoomMagnitude >= ZOOM_THRESHOLD &&
    zoomMagnitude >= panMagnitude &&
    zoomMagnitude >= tiltMagnitude
  ) {
    return 'zoom';
  }
  if (panMagnitude >= PAN_TILT_THRESHOLD && panMagnitude >= tiltMagnitude) {
    return 'pan';
  }
  if (tiltMagnitude >= PAN_TILT_THRESHOLD) {
    return 'tilt';
  }
  return 'static';
}

function sign(value: number): number {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

// Pure, synchronous summary derivation over detectCameraMotion()'s raw
// samples - a separate function from the subprocess-calling one, same
// reason as every other deriveXFeatures in this pipeline. Per explicit user
// design direction: the Python script (detect_camera_motion.py) computes
// ONLY the raw dx/dy/scale/rotation/ecc transform per sample - turning that
// into panScore/tiltScore/zoomScore/shakeScore is entirely this function's
// job.
export function deriveCameraMotionFeatures(samples: CameraMotionSample[]): CameraMotionFeatures {
  const classifiable = samples.filter(isClassifiable);

  if (classifiable.length === 0) {
    return {
      panScore: null,
      tiltScore: null,
      zoomScore: null,
      shakeScore: null,
      dominantMotionType: null,
    };
  }

  const classifications = classifiable.map(classifySample);
  const panCount = classifications.filter((c) => c === 'pan').length;
  const tiltCount = classifications.filter((c) => c === 'tilt').length;
  const zoomCount = classifications.filter((c) => c === 'zoom').length;
  const staticCount = classifications.filter((c) => c === 'static').length;

  const panScore = panCount / classifiable.length;
  const tiltScore = tiltCount / classifiable.length;
  const zoomScore = zoomCount / classifiable.length;

  // Shake: fraction of consecutive classifiable-sample PAIRS where dx or dy
  // reverses sign - a proxy for erratic back-and-forth motion, distinct
  // from sustained panning/tilting in one direction. Both samples in a pair
  // must clear PAN_TILT_THRESHOLD (reused, not a separate constant) before
  // a sign flip counts as a "reversal" - otherwise sub-threshold noise
  // (e.g. two near-zero dx readings that happen to differ in sign) would
  // dominate shakeScore for an essentially static clip. See this schema
  // field's own contract comment for the sampling-rate honesty caveat.
  let reversals = 0;
  for (let i = 1; i < classifiable.length; i++) {
    const previous = classifiable[i - 1];
    const current = classifiable[i];
    const dxReversed =
      Math.abs(previous.dx) >= PAN_TILT_THRESHOLD &&
      Math.abs(current.dx) >= PAN_TILT_THRESHOLD &&
      sign(previous.dx) !== sign(current.dx);
    const dyReversed =
      Math.abs(previous.dy) >= PAN_TILT_THRESHOLD &&
      Math.abs(current.dy) >= PAN_TILT_THRESHOLD &&
      sign(previous.dy) !== sign(current.dy);
    if (dxReversed || dyReversed) reversals++;
  }
  const shakeScore = classifiable.length >= 2 ? reversals / (classifiable.length - 1) : null;

  // Dominant motion type - shake takes priority over a coincidental pan/
  // tilt/zoom majority when it's frequent enough (erratic motion is a
  // qualitatively different read than a sustained camera move), otherwise
  // the most common classified type wins. Ties break toward earlier
  // categories in this fixed priority order (static, pan, tilt, zoom) - an
  // arbitrary but deterministic rule, not a claim about which type matters
  // more.
  let dominantMotionType: CameraMotionType = 'static';
  let bestCount = staticCount;
  if (panCount > bestCount) {
    dominantMotionType = 'pan';
    bestCount = panCount;
  }
  if (tiltCount > bestCount) {
    dominantMotionType = 'tilt';
    bestCount = tiltCount;
  }
  if (zoomCount > bestCount) {
    dominantMotionType = 'zoom';
    bestCount = zoomCount;
  }
  if (shakeScore !== null && shakeScore >= SHAKE_DOMINANT_THRESHOLD) {
    dominantMotionType = 'shake';
  }

  return { panScore, tiltScore, zoomScore, shakeScore, dominantMotionType };
}
