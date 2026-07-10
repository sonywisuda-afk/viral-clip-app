import { z } from 'zod';

// AI Fusion roadmap's Face Intelligence initiative, Batch 4.5 - explicitly
// NOT a new AI signal (user's own framing: "bukan menambah AI baru").
// Everything here is telemetry/auditability over Batch 4's own tracking
// mechanism (Kalman Filter + Hungarian Assignment + IoU + pose consistency,
// see face-landmarks.ts's trackId/faceDescriptor comments) - it exists so a
// human (or a future "why was this clip picked" UI) can inspect HOW
// trustworthy a clip's face tracking actually was, not to feed the Fusion
// Engine's scoring. Deliberately a SEPARATE schema/signal from
// faceLandmarkFeaturesSchema, not folded into it, to keep "features that
// drive scoring" and "telemetry about tracking quality" from being
// conflated - see @speedora/facial-intelligence's
// deriveTrackingQualityMetrics for the derivation and every threshold's
// honest "unvalidated guess" caveat.

// Per-track-run breakdown - one entry per contiguous trackId run (see
// detect_face_landmarks.py's FaceTracker: in this single-object tracker,
// a trackId value is only ever assigned to ONE contiguous run by
// construction, since a lost track always gets a brand-new incrementing id
// rather than reusing an old one - "per trackId" and "per run" coincide
// here, but this is still computed by grouping into runs, not by raw id
// equality, so the logic wouldn't silently break if that ever changed).
export const trackSegmentQualitySchema = z.object({
  trackId: z.number().int(),
  frameCount: z.number().int().min(1),
  // Clip-relative seconds (same timeline as FaceLandmarkSample.t) of this
  // run's first/last sample - lets a UI show WHEN this track was on screen.
  startTime: z.number(),
  endTime: z.number(),
  // Fraction of this run's samples whose mouthContrastRatio fell below
  // OCCLUSION_CONTRAST_THRESHOLD - same coarse proxy/caveat as
  // faceLandmarkFeaturesSchema's occlusionRate, scoped to just this run.
  // Null when none of this run's samples had a mouthContrastRatio reading.
  occlusionRatio: z.number().min(0).max(1).nullable(),
  // Composite 0-1 proxy for "how trustworthy is this specific run",
  // combining normalized sharpness, inverse occlusion, and inverse jitter
  // (whichever of those are available for this run) - NOT a real per-
  // landmark confidence score (MediaPipe's FaceLandmarker does not expose
  // one, unlike pose landmarks - see faceLandmarkFeaturesSchema's
  // visibilityScore comment for the same honest gap). Null only when NONE
  // of the inputs were available for this run.
  confidence: z.number().min(0).max(1).nullable(),
  // 1 when this run's OWN START was flagged as a likely continuation of
  // the immediately preceding run under a different trackId (i.e. the
  // tracker probably lost and re-acquired the same physical person rather
  // than a genuinely new one) - a heuristic guess from face-descriptor
  // similarity across the break, not a certain fact (no ground-truth
  // identity exists anywhere in this pipeline). 0 for the very first run
  // in a clip (nothing to compare against) or when either side of the
  // break lacks a faceDescriptor reading.
  idSwitchCount: z.union([z.literal(0), z.literal(1)]),
  // A coarse "was this run long/clean enough to trust at a glance" flag -
  // frameCount above a minimum AND occlusionRatio/jitter below their own
  // thresholds (see MIN_STABLE_TRACK_FRAMES/STABLE_OCCLUSION_MAX/
  // STABLE_JITTER_MAX in the deriving module) - unvalidated guesses, same
  // as every other threshold in this pipeline.
  stable: z.boolean(),
});

export const faceTrackingQualityMetricsSchema = z.object({
  // Fraction of consecutive same-track-eligible sample pairs where the
  // trackId actually changed - normalized [0,1] view of the same
  // transitions faceLandmarkFeaturesSchema's speakerChangeCount already
  // counts as a raw count (see that field's own comment). Null when there
  // are fewer than 2 samples with a trackId to compare (nothing to
  // fragment).
  trackFragmentationRate: z.number().min(0).max(1).nullable(),
  // Count of track-run boundaries flagged as a likely id switch (see
  // trackSegmentQualitySchema.idSwitchCount) - sum of that per-run flag
  // across the whole clip, not an independent measurement.
  idSwitchCount: z.number().int().min(0).nullable(),
  // Total seconds spent in a "face briefly not detected at all" gap that
  // has a tracked face on BOTH sides (mid-clip gaps only - a face that
  // simply never appears, or leaves and never returns, isn't a "lost
  // track" in this sense, it's just absence). Computed from sample count
  // in each such gap times FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS, not a
  // precise sub-second measurement.
  lostTrackDurationSeconds: z.number().min(0).nullable(),
  // Of the mid-clip gaps counted above, the fraction where the trackId
  // AFTER the gap matched the trackId BEFORE it (the Kalman prediction +
  // matching successfully bridged the gap) rather than starting a fresh
  // track. Null when there were zero such gaps to evaluate (not merely
  // inconclusive - see faceLandmarkFeaturesSchema's speakerAudioSyncRate
  // comment for the same null-vs-zero distinction).
  reidentificationSuccessRate: z.number().min(0).max(1).nullable(),
  // Same computation as faceLandmarkFeaturesSchema's visibilityScore
  // (fraction of ALL sampled frames with a detected face), deliberately
  // recomputed here rather than cross-referenced so this object is
  // self-contained for a telemetry/explainability consumer that only
  // fetches trackingQualityMetrics.
  faceVisibilityRatio: z.number().min(0).max(1).nullable(),
  // Same computation as faceLandmarkFeaturesSchema's occlusionRate, same
  // self-containment reasoning as faceVisibilityRatio above.
  faceOcclusionRatio: z.number().min(0).max(1).nullable(),
  // Clip-wide version of trackSegmentQualitySchema's per-run confidence
  // proxy - see that field's own comment for the "not a real MediaPipe
  // confidence" caveat. Named to match the user's requested vocabulary,
  // NOT a claim that MediaPipe FaceLandmarker exposes this natively.
  averageLandmarkConfidence: z.number().min(0).max(1).nullable(),
  // Average frame-to-frame movement of the face bounding-box center
  // WITHIN a single track run (excludes the jump across a track break,
  // which is a fragmentation event, not jitter of a continuously-tracked
  // face), normalized against JITTER_CAP - a genuinely computed motion-
  // smoothness signal (not a fabricated proxy), though the cap itself is
  // an unvalidated guess like every other cap in this pipeline. Higher =
  // more jitter (worse), same "raw semantics, invert later if needed"
  // convention as occlusionRate.
  landmarkJitterScore: z.number().min(0).nullable(),
  // Fraction of trackId transitions that were a CONTINUATION of the
  // existing Kalman filter (kalman.correct() on a match) rather than a
  // fresh reinitialization - exactly the complement of
  // trackFragmentationRate (1 - trackFragmentationRate), exposed under
  // this name too because it answers a different question a reader might
  // ask ("how often did the filter get to refine its estimate" vs. "how
  // fragmented is this track overall") even though it's the same
  // underlying computation, not an independent measurement.
  kalmanCorrectionRatio: z.number().min(0).max(1).nullable(),
  // Single "at a glance" 0-1 headline number - unweighted average of
  // whichever of {kalmanCorrectionRatio, faceVisibilityRatio, 1 -
  // faceOcclusionRatio, averageLandmarkConfidence, 1 -
  // landmarkJitterScore} are available. An arbitrary composite for
  // display purposes, explicitly NOT a calibrated model output - same
  // honesty as every other composite in this pipeline.
  trackingConfidence: z.number().min(0).max(1).nullable(),
  tracks: z.array(trackSegmentQualitySchema),
});

export type TrackSegmentQuality = z.infer<typeof trackSegmentQualitySchema>;
export type FaceTrackingQualityMetrics = z.infer<typeof faceTrackingQualityMetricsSchema>;
