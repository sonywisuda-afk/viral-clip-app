import type {
  FaceLandmarkSample,
  FaceTrackingQualityMetrics,
  TrackSegmentQuality,
} from '@speedora/contracts';
import { FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS } from './detect-face-landmarks';
import { OCCLUSION_CONTRAST_THRESHOLD } from './derive-face-landmark-features';

// Batch 4.5 (Quality Metrics & Telemetry) - explicitly NOT a new AI signal
// (user's own framing). Everything below is telemetry over Batch 4's own
// Kalman+Hungarian+IoU+pose tracker, computed purely from the raw samples
// it already emits (no Python script changes needed) - so this applies
// retroactively to any face landmark data already collected before this
// batch shipped.

// Laplacian-variance cap used as a sharpness->confidence proxy - same
// value as @speedora/fusion-engine's own SHARPNESS_CAP, duplicated (not
// imported) because these are separate packages with no shared-constants
// module; keep both in sync if this cap is ever recalibrated against real
// footage.
const SHARPNESS_CAP = 500;

// Typical frame-to-frame bounding-box-center movement (normalized [0,1]
// coordinates) for a smoothly-tracked, mostly-still talking-head subject -
// jitter at/above this reads as "maximally jittery" (score 1). An
// unvalidated guess, same as every other cap in this pipeline.
const JITTER_CAP = 0.1;

// A track-run boundary whose face-descriptor distance to the PRECEDING
// run's last sample falls below this is flagged as a likely id switch
// (probably the same physical person, re-acquired under a new id) rather
// than a genuinely new appearance. Independently chosen from Python's own
// DESCRIPTOR_NORM (not ported/reused) - this is a new, separately-defined
// telemetry heuristic, not a re-implementation of the tracker's own cost
// function. Unvalidated guess.
const ID_SWITCH_DESCRIPTOR_THRESHOLD = 0.5;

// A track run needs at least this many samples before it's eligible to be
// called "stable" - a one-or-two-sample blip isn't long enough to judge,
// regardless of how clean it looks. Unvalidated guess.
const MIN_STABLE_TRACK_FRAMES = 3;
const STABLE_OCCLUSION_MAX = 0.3;
const STABLE_JITTER_MAX = 0.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Mean absolute difference across corresponding elements - a simple,
// independently-defined distance for THIS heuristic, not required to match
// detect_face_landmarks.py's own descriptor_distance() bit-for-bit (that
// one feeds the tracker's real-time match decision; this one is a
// after-the-fact telemetry judgment call). Returns null if the two
// descriptors don't have the same length (shouldn't happen given both come
// from the same fixed-length face_descriptor() output, but not assumed).
function descriptorDistance(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function occlusionRatioOf(samples: FaceLandmarkSample[]): number | null {
  const withMouthContrast = samples.filter((sample) => sample.mouthContrastRatio !== null);
  if (withMouthContrast.length === 0) return null;
  return (
    withMouthContrast.filter((sample) => sample.mouthContrastRatio! < OCCLUSION_CONTRAST_THRESHOLD)
      .length / withMouthContrast.length
  );
}

// Sharpness-normalized confidence proxy - NOT a real per-landmark
// confidence (MediaPipe's FaceLandmarker exposes none, see this module's
// own schema comment for the full caveat).
function landmarkConfidenceOf(samples: FaceLandmarkSample[]): number | null {
  const withSharpness = samples.filter((sample) => sample.sharpness !== null);
  if (withSharpness.length === 0) return null;
  const averageSharpness =
    withSharpness.reduce((sum, sample) => sum + sample.sharpness!, 0) / withSharpness.length;
  return clamp01(averageSharpness / SHARPNESS_CAP);
}

// Average frame-to-frame bounding-box-center movement across CONSECUTIVE
// samples within one already-grouped run (caller guarantees no track break
// is included) - null when fewer than 2 samples (nothing to compare).
function jitterScoreOf(samples: FaceLandmarkSample[]): number | null {
  if (samples.length < 2) return null;
  const distances: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].boundingBox!;
    const b = samples[i].boundingBox!;
    const dx = b.xCenter - a.xCenter;
    const dy = b.yCenter - a.yCenter;
    distances.push(Math.sqrt(dx * dx + dy * dy));
  }
  return clamp01(average(distances)! / JITTER_CAP);
}

function combineConfidence(parts: (number | null)[]): number | null {
  const present = parts.filter((value): value is number => value !== null);
  return average(present);
}

interface TrackRun {
  trackId: number;
  samples: FaceLandmarkSample[];
}

// Groups samples-with-a-trackId into contiguous same-trackId runs. Grouped
// by adjacency, not by raw trackId equality across the whole array - in
// THIS single-object tracker a trackId value only ever appears in one
// contiguous run by construction (a lost track always gets a brand-new
// incrementing id, never reuses an old one), but grouping by adjacency
// keeps this correct even if that tracker behavior ever changed.
function groupIntoRuns(withTrackId: FaceLandmarkSample[]): TrackRun[] {
  const runs: TrackRun[] = [];
  for (const sample of withTrackId) {
    const last = runs[runs.length - 1];
    if (last && last.trackId === sample.trackId) {
      last.samples.push(sample);
    } else {
      runs.push({ trackId: sample.trackId!, samples: [sample] });
    }
  }
  return runs;
}

const EMPTY_METRICS_BASE: Omit<FaceTrackingQualityMetrics, 'faceVisibilityRatio'> = {
  trackFragmentationRate: null,
  idSwitchCount: null,
  lostTrackDurationSeconds: null,
  reidentificationSuccessRate: null,
  faceOcclusionRatio: null,
  averageLandmarkConfidence: null,
  landmarkJitterScore: null,
  kalmanCorrectionRatio: null,
  trackingConfidence: null,
  tracks: [],
};

export function deriveTrackingQualityMetrics(
  samples: FaceLandmarkSample[],
): FaceTrackingQualityMetrics {
  const withFace = samples.filter((sample) => sample.boundingBox !== null);
  // Same "samples.length === 0 -> null, otherwise 0" distinction as
  // faceLandmarkFeaturesSchema's visibilityScore - "no data collected at
  // all" reads differently from "data collected, face never found".
  const faceVisibilityRatio = samples.length === 0 ? null : withFace.length / samples.length;

  if (withFace.length === 0) {
    return { ...EMPTY_METRICS_BASE, faceVisibilityRatio };
  }

  const withTrackId = withFace.filter((sample) => sample.trackId !== null);
  const runs = groupIntoRuns(withTrackId);

  // --- fragmentation / Kalman correction (complementary views of the same
  // trackId-transition count) ---
  let fragmentationEvents = 0;
  for (let i = 1; i < withTrackId.length; i++) {
    if (withTrackId[i].trackId !== withTrackId[i - 1].trackId) fragmentationEvents++;
  }
  const trackFragmentationRate =
    withTrackId.length > 1 ? fragmentationEvents / (withTrackId.length - 1) : null;
  const kalmanCorrectionRatio =
    trackFragmentationRate === null ? null : clamp01(1 - trackFragmentationRate);

  // --- id switch heuristic, evaluated at each run boundary ---
  const likelySwitchAtRun = runs.map(() => false);
  for (let i = 1; i < runs.length; i++) {
    const prevLast = runs[i - 1].samples[runs[i - 1].samples.length - 1];
    const currFirst = runs[i].samples[0];
    if (prevLast.faceDescriptor && currFirst.faceDescriptor) {
      const distance = descriptorDistance(prevLast.faceDescriptor, currFirst.faceDescriptor);
      if (distance !== null && distance < ID_SWITCH_DESCRIPTOR_THRESHOLD) {
        likelySwitchAtRun[i] = true;
      }
    }
  }
  const idSwitchCount = likelySwitchAtRun.filter(Boolean).length;

  // --- lost-track duration + re-identification success, over the FULL
  // sample array (a "lost track" gap is about face detection entirely
  // disappearing, not about trackId specifically) ---
  let lostTrackDurationSeconds = 0;
  let reidentificationAttempts = 0;
  let reidentificationSuccesses = 0;
  {
    let i = 0;
    while (i < samples.length) {
      if (samples[i].boundingBox !== null) {
        i++;
        continue;
      }
      const gapStart = i;
      while (i < samples.length && samples[i].boundingBox === null) i++;
      const gapEnd = i;
      const hasBefore = gapStart > 0 && samples[gapStart - 1].boundingBox !== null;
      const hasAfter = gapEnd < samples.length && samples[gapEnd].boundingBox !== null;
      if (hasBefore && hasAfter) {
        lostTrackDurationSeconds += (gapEnd - gapStart) * FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS;
        const beforeTrackId = samples[gapStart - 1].trackId;
        const afterTrackId = samples[gapEnd].trackId;
        if (beforeTrackId !== null && afterTrackId !== null) {
          reidentificationAttempts++;
          if (beforeTrackId === afterTrackId) reidentificationSuccesses++;
        }
      }
    }
  }
  const reidentificationSuccessRate =
    reidentificationAttempts === 0 ? null : reidentificationSuccesses / reidentificationAttempts;

  const faceOcclusionRatio = occlusionRatioOf(withFace);
  const averageLandmarkConfidence = landmarkConfidenceOf(withFace);

  const runJitterScores = runs
    .map((run) => jitterScoreOf(run.samples))
    .filter((value): value is number => value !== null);
  const landmarkJitterScore = average(runJitterScores);

  const trackingConfidence = combineConfidence([
    kalmanCorrectionRatio,
    faceVisibilityRatio,
    faceOcclusionRatio === null ? null : 1 - faceOcclusionRatio,
    averageLandmarkConfidence,
    landmarkJitterScore === null ? null : 1 - landmarkJitterScore,
  ]);

  const tracks: TrackSegmentQuality[] = runs.map((run, index) => {
    const runOcclusionRatio = occlusionRatioOf(run.samples);
    const runJitterScore = jitterScoreOf(run.samples);
    const runConfidence = combineConfidence([
      landmarkConfidenceOf(run.samples),
      runOcclusionRatio === null ? null : 1 - runOcclusionRatio,
      runJitterScore === null ? null : 1 - runJitterScore,
    ]);
    const stable =
      run.samples.length >= MIN_STABLE_TRACK_FRAMES &&
      (runOcclusionRatio === null || runOcclusionRatio < STABLE_OCCLUSION_MAX) &&
      (runJitterScore === null || runJitterScore < STABLE_JITTER_MAX);

    return {
      trackId: run.trackId,
      frameCount: run.samples.length,
      startTime: run.samples[0].t,
      endTime: run.samples[run.samples.length - 1].t,
      occlusionRatio: runOcclusionRatio,
      confidence: runConfidence,
      idSwitchCount: likelySwitchAtRun[index] ? 1 : 0,
      stable,
    };
  });

  return {
    trackFragmentationRate,
    idSwitchCount,
    lostTrackDurationSeconds,
    reidentificationSuccessRate,
    faceVisibilityRatio,
    faceOcclusionRatio,
    averageLandmarkConfidence,
    landmarkJitterScore,
    kalmanCorrectionRatio,
    trackingConfidence,
    tracks,
  };
}
