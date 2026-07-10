import { z } from 'zod';
import { intelligenceSignalSchema } from './intelligence-signal';

// AI Fusion roadmap's Face Intelligence initiative, Batch 1 - MediaPipe's
// FaceLandmarker Task (468 3D mesh points + 10 iris points + 52 blendshape
// scores + a per-face facial transformation matrix) covers Blink/Smile/
// Mouth-Open (blendshapes), Face Rotation (decomposed from the
// transformation matrix), and Position/Size/Visibility Score (landmark
// bounding geometry) in ONE model pass - see the roadmap's own gap analysis
// for why these are grouped together rather than built as separate
// detectors. Eye Contact/Looking Direction (Batch 2) reuse this SAME raw
// sample's iris landmarks rather than a second MediaPipe call - see
// face-landmarks.ts's own `irisLandmarks` field below.

export const detectFaceLandmarksInputSchema = z.object({
  sourcePath: z.string().min(1),
  startTime: z.number(),
  endTime: z.number(),
});

// A single 3D point, normalized [0, 1] relative to frame width/height/depth
// (MediaPipe's own convention - z is relative to face size, not real-world
// units). Only the handful of named points Batch 1/2 actually consume are
// carried through (not all 478) - see the script's own module comment for
// which landmark indices these are mapped from.
export const normalizedPoint3dSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

// Named blendshape scores (0-1, MediaPipe's own scale) actually consumed by
// Batch 1's derived features - a small named subset of MediaPipe's full
// 52-category output, not all of them (the rest carry no feature mapping
// yet and would just be dead weight in every persisted row).
export const faceBlendshapesSchema = z.object({
  eyeBlinkLeft: z.number().min(0).max(1),
  eyeBlinkRight: z.number().min(0).max(1),
  mouthSmileLeft: z.number().min(0).max(1),
  mouthSmileRight: z.number().min(0).max(1),
  jawOpen: z.number().min(0).max(1),
  // Batch 5B (Smile & Laugh) - the orbicularis-oculi "eye crinkle"/cheek-
  // raise markers of a GENUINE ("Duchenne") smile, as opposed to a posed
  // one that only activates the mouth (mouthSmileLeft/Right above). See
  // deriveFaceLandmarkFeatures's genuineSmileRate for how these combine.
  cheekSquintLeft: z.number().min(0).max(1),
  cheekSquintRight: z.number().min(0).max(1),
  eyeSquintLeft: z.number().min(0).max(1),
  eyeSquintRight: z.number().min(0).max(1),
  // Batch 5D (Emotion Heuristic) - eyebrow movement, one of the signals
  // deriveFaceLandmarkFeatures combines into the dominantAffect heuristic.
  // Tracked as both "up" and "down" directions but averaged into an
  // UNDIRECTED magnitude downstream (see averageBrowActivity) - this
  // heuristic only cares how much the eyebrows move, not which way,
  // per user's own explicit direction to avoid directional emotion claims.
  browDownLeft: z.number().min(0).max(1),
  browDownRight: z.number().min(0).max(1),
  browInnerUp: z.number().min(0).max(1),
  browOuterUpLeft: z.number().min(0).max(1),
  browOuterUpRight: z.number().min(0).max(1),
});

// Decomposed from MediaPipe's 4x4 facial transformation matrix - degrees,
// not radians, so a caller/UI never has to convert. yaw=0/pitch=0/roll=0 is
// looking straight at the camera.
export const faceRotationSchema = z.object({
  pitch: z.number(),
  yaw: z.number(),
  roll: z.number(),
});

// One sampled frame's worth of landmark output - null across every field
// means "no face found in this sampled frame" (same convention as
// FacialEmotionSample/FaceSample), not an error.
export const faceLandmarkSampleSchema = z.object({
  t: z.number(),
  blendshapes: faceBlendshapesSchema.nullable(),
  rotation: faceRotationSchema.nullable(),
  // Face bounding box derived from the landmark cloud, normalized [0, 1] -
  // same shape/convention as @speedora/reframe's FaceSample.box, kept
  // separate from it (that one comes from FaceDetector, this one from
  // FaceLandmarker) rather than unified, since the two detectors run at
  // different pipeline stages for different purposes.
  boundingBox: z
    .object({ xCenter: z.number(), yCenter: z.number(), width: z.number(), height: z.number() })
    .nullable(),
  // Left/right iris center points (2 of MediaPipe's 10 iris landmarks) -
  // reused by Batch 2 (Eye Contact/Looking Direction) rather than a second
  // FaceLandmarker call. Present here (not a separate raw signal) because
  // it's the exact same subprocess invocation/sample producing it.
  leftIris: normalizedPoint3dSchema.nullable(),
  rightIris: normalizedPoint3dSchema.nullable(),
  // Left/right eye corner points (for Batch 2's gaze-offset calculation -
  // iris position is only meaningful relative to where the eye socket is).
  leftEyeInnerCorner: normalizedPoint3dSchema.nullable(),
  leftEyeOuterCorner: normalizedPoint3dSchema.nullable(),
  rightEyeInnerCorner: normalizedPoint3dSchema.nullable(),
  rightEyeOuterCorner: normalizedPoint3dSchema.nullable(),
  // AI Fusion roadmap's Face Intelligence initiative, Batch 3 (Blur/
  // Sharpness/Lighting/Occlusion) - pixel-level OpenCV measurements on the
  // SAME cropped frame Batch 1 already reads, not a separate pass. See
  // detect_face_landmarks.py's own module comment for exactly how each is
  // computed and this heuristic's honest limitations (mouthContrastRatio
  // especially - a coarse occlusion PROXY, not a trained detector).
  //
  // Raw Laplacian variance of the whole face crop (grayscale) - the
  // standard blur-detection measurement; higher = sharper. Serves both
  // "Blur Detection" and "Face Sharpness Score" from the original feature
  // list (the same underlying number, read in opposite directions - not
  // two separate measurements).
  sharpness: z.number().min(0).nullable(),
  // Mean grayscale pixel value (0-255) of the face crop - "Face Lighting
  // Score"'s raw input.
  brightness: z.number().min(0).max(255).nullable(),
  // Mouth region's own local Laplacian variance divided by the whole-face
  // crop's variance - low ratio suggests the mouth region is anomalously
  // smoother/flatter than the rest of the face (a hand/object covering it),
  // but a naturally still/closed mouth can ALSO read low - this is the
  // least-confident heuristic in this module, treated accordingly by
  // deriveFaceLandmarkFeatures's occlusionRate.
  mouthContrastRatio: z.number().min(0).nullable(),
  // AI Fusion roadmap's Face Intelligence initiative, Batch 4 (Face Re-
  // identification/Tracking) - a fixed-length (9) vector of scale-invariant
  // inter-landmark distance ratios ("geometric fingerprint"), explicitly
  // NOT a trained face-recognition embedding - see
  // detect_face_landmarks.py's module comment for the honest accuracy
  // trade-off this implies (explicit user direction to avoid a new heavy
  // ML dependency). Consumed by @speedora/facial-intelligence's tracking-
  // cost calculation only via the script's own trackId output below - not
  // re-derived in TypeScript.
  faceDescriptor: z.array(z.number()).nullable(),
  // Which single-object track (see detect_face_landmarks.py's FaceTracker -
  // Kalman Filter + Hungarian Assignment + IoU + pose consistency) this
  // sample's detected face belongs to - a plain incrementing integer, new
  // value each time the tracker decides this detection does NOT continue
  // the previous track. Two samples with the same trackId are the
  // script's best guess that they show the same person; this is the
  // mechanism @speedora/facial-intelligence's deriveFaceLandmarkFeatures
  // uses to derive speakerChangeCount/dominantSpeakerConsistency, not a
  // feature exposed on its own.
  trackId: z.number().int().nullable(),
  // Batch 5B (Smile & Laugh) - mouth corner-to-corner distance divided by
  // inter-ocular baseline distance, the SAME scale-invariant normalization
  // as faceDescriptor's ratios, but computed/exposed independently since
  // this one IS a genuinely meaningful named feature (unlike
  // faceDescriptor's opaque tracking-only array) - see
  // detect_face_landmarks.py's mouth_width_ratio().
  mouthWidth: z.number().min(0).nullable(),
});

export const detectFaceLandmarksOutputSchema = z.array(faceLandmarkSampleSchema);

// AI Fusion roadmap's Face Intelligence initiative, Batch 2 - a per-sample
// looking-direction bucket derived from Batch 1's own iris/eye-corner/head-
// rotation data (no new subprocess call or raw field - see
// deriveFaceLandmarkFeatures's own comment for the derivation). 'center'
// specifically means "eyes AND head both roughly facing the camera" - see
// eyeContactRate below, which is defined in terms of this bucket.
export const LOOKING_DIRECTIONS = ['center', 'left', 'right', 'up', 'down'] as const;
export type LookingDirection = (typeof LOOKING_DIRECTIONS)[number];

// AI Fusion roadmap's Face Intelligence initiative, Batch 5D (Emotion
// Heuristic) - deliberately SAFE, non-diagnostic vocabulary, explicit user
// instruction: never a discrete emotion name (no "happy"/"sad"/"angry").
// See faceLandmarkFeaturesSchema's dominantAffect comment for the full
// rationale and @speedora/facial-intelligence's deriveFaceLandmarkFeatures
// for the deterministic (not trained) decision tree that produces one.
export const AFFECT_LABELS = [
  'positive_affect',
  'high_energy',
  'low_energy',
  'expressive',
  'neutral',
] as const;
export type AffectLabel = (typeof AFFECT_LABELS)[number];

// Derived summary the Fusion Engine actually consumes (see
// packages/contracts/src/intelligence-signal.ts) - computed from the raw
// samples above by @speedora/facial-intelligence's
// deriveFaceLandmarkFeatures(). All fields null when there were zero
// samples with a detected face - not fabricated zeros/neutral values.
export const faceLandmarkFeaturesSchema = z.object({
  // Fraction of classified samples where either eye's blink blendshape
  // crossed BLINK_THRESHOLD (see the deriving module) - a rate, not a
  // count, so it's comparable across clips of different lengths.
  blinkRate: z.number().min(0).nullable(),
  // Average of both mouthSmileLeft/Right across samples with a face.
  averageSmile: z.number().min(0).max(1).nullable(),
  // Average jawOpen across samples with a face.
  averageMouthOpen: z.number().min(0).max(1).nullable(),
  // Average absolute yaw/pitch - "how far off-center does this speaker
  // typically turn", not signed (a speaker turning consistently left vs.
  // consistently right are equally "off-center" for this purpose).
  averageAbsoluteYaw: z.number().min(0).nullable(),
  averageAbsolutePitch: z.number().min(0).nullable(),
  // How centered the face's bounding box is in-frame on average, 1 =
  // dead-center, 0 = at the very edge - see the deriving module for the
  // exact distance-from-center formula.
  positionScore: z.number().min(0).max(1).nullable(),
  // How much of the frame the face's bounding box occupies on average, 0-1
  // raw area ratio (not a subjective "good"/"bad" judgment - a talking-head
  // clip and a wide establishing shot legitimately want different values).
  sizeScore: z.number().min(0).max(1).nullable(),
  // Fraction of sampled frames where a face was actually found at all -
  // "was the speaker in frame", not a per-landmark confidence (MediaPipe's
  // FaceLandmarker doesn't expose a meaningful per-landmark visibility
  // score for face mesh the way it does for pose landmarks, so this is
  // deliberately the coarser, honestly-available signal rather than a
  // fabricated finer one).
  visibilityScore: z.number().min(0).max(1).nullable(),
  // Batch 2 - fraction of samples-with-a-face whose derived
  // lookingDirection resolved to 'center' (both iris position AND head
  // rotation roughly facing the camera - see deriveFaceLandmarkFeatures's
  // comment on the exact thresholds/heuristic). A coarse proxy, not a
  // calibrated gaze-tracking measurement - MediaPipe's iris landmarks are
  // a well-known noisy signal for this (see CLAUDE.md's roadmap note on
  // Eye Contact).
  eyeContactRate: z.number().min(0).max(1).nullable(),
  // Most frequent per-sample looking-direction bucket, ties broken by
  // first occurrence (same convention as dominantEmotion/dominantGesture).
  dominantLookingDirection: z.enum(LOOKING_DIRECTIONS).nullable(),
  // Batch 3 - raw units (Laplacian-variance / 0-255), left unnormalized
  // here same as averageAbsoluteYaw/Pitch above - @speedora/fusion-engine's
  // feature-pipeline.ts normalizes both to [0,1] with an explicit,
  // documented cap.
  averageSharpness: z.number().min(0).nullable(),
  averageBrightness: z.number().min(0).max(255).nullable(),
  // Fraction of samples-with-a-face whose mouthContrastRatio fell below
  // the occlusion threshold (see deriveFaceLandmarkFeatures) - already a
  // 0-1 rate, same convention as blinkRate/eyeContactRate above. A coarse
  // heuristic proxy, NOT a trained occlusion classifier - see this
  // schema's mouthContrastRatio comment for the honest caveat.
  occlusionRate: z.number().min(0).max(1).nullable(),
  // AI Fusion roadmap's Face Intelligence initiative, Batch 4 - derived
  // from the sequence of the script's own trackId output (see
  // faceLandmarkSampleSchema's trackId comment for the Kalman+Hungarian+
  // IoU+pose tracking mechanism that produces it). Both null when zero
  // samples-with-a-face had a trackId (should only happen alongside the
  // "no face at all" null case above, since a face without a trackId isn't
  // possible given the script always tracks whatever it detects).
  //
  // Count of times trackId changes between consecutive samples-with-a-
  // face - a proxy for "how many times did the visible speaker change
  // during this clip" (Face Tracking's practical meaning in a pipeline
  // that only ever follows the single most prominent face per frame).
  speakerChangeCount: z.number().int().min(0).nullable(),
  // Fraction of samples-with-a-face belonging to the single MOST COMMON
  // trackId (the longest contiguous "same visible person" run divided by
  // total samples-with-a-face) - 1 means one consistent person for the
  // whole clip, lower means the camera cut between different people.
  dominantSpeakerConsistency: z.number().min(0).max(1).nullable(),
  // Speaker Face Selection's "real" version (replacing Fase 2's plain
  // largest-bounding-box heuristic) - fraction of samples where mouth
  // movement (jawOpen blendshape) agrees with whether the clip's audio
  // has audible speech at that moment (correlated against transcript
  // segments' rmsDb, Fase 25 - computed in TypeScript, see
  // deriveFaceLandmarkFeatures's own comment, since this script has no
  // access to audio/transcript data at all). High means the shown face is
  // plausibly the one actually talking; low suggests a reaction shot or a
  // face shown while someone else (off-camera) speaks. Null when no
  // audio-timing data was supplied to the deriving function at all (an
  // optional parameter), not when it's merely inconclusive.
  speakerAudioSyncRate: z.number().min(0).max(1).nullable(),
  // AI Fusion roadmap's Face Intelligence initiative, Batch 5A (Lip
  // Activity) - all four derived purely from the jawOpen blendshape
  // sequence already collected since Batch 1, no new raw field/script
  // change needed (see deriveFaceLandmarkFeatures's own comments for exact
  // formulas). "Mouth openness" itself is the pre-existing
  // averageMouthOpen above - these four add TEMPORAL DYNAMICS on top of
  // that flat average (how fast, how intensely, how often paused, how
  // varied).
  //
  // Average frame-to-frame |jawOpen delta| per second between consecutive
  // samples-with-blendshapes - raw units (blendshape-per-second),
  // normalized later in fusion-engine same convention as
  // averageAbsoluteYaw/Pitch. Higher = more active mouth movement.
  averageLipVelocity: z.number().min(0).nullable(),
  // Average jawOpen among samples where jawOpen already crossed
  // MOUTH_ACTIVITY_THRESHOLD (the "actively speaking" subset) - distinct
  // from averageMouthOpen, which is dragged down by closed-mouth silence;
  // this asks "when the mouth WAS active, how open was it" instead. Null
  // when no sample ever crossed the activity threshold.
  speakingIntensity: z.number().min(0).max(1).nullable(),
  // Count of sustained runs (>= MIN_PAUSE_SAMPLES consecutive samples-
  // with-blendshapes, a reasonable guess not calibrated) where jawOpen
  // stayed below MOUTH_ACTIVITY_THRESHOLD - a coarse proxy for "did the
  // speaker pause mid-clip", not a linguistically-informed pause detector
  // (it can't distinguish a dramatic pause from simply not being visible/
  // not talking at that moment).
  pauseCount: z.number().int().min(0).nullable(),
  // Count of direction reversals in the jawOpen sequence (open->close or
  // close->open) divided by elapsed seconds between the first and last
  // samples-with-blendshapes - a coarse proxy for "how varied/complex is
  // the mouth movement", not a phoneme-aware articulation measurement; it
  // cannot distinguish active speech from e.g. repeated chewing/yawning.
  // Null when fewer than 3 samples-with-blendshapes (need at least 2
  // deltas to detect one reversal) or when elapsed time is 0.
  articulationRate: z.number().min(0).nullable(),
  // AI Fusion roadmap's Face Intelligence initiative, Batch 5B (Smile &
  // Laugh) - averageMouthWidth/averageCheekRaise/averageEyeSquint are plain
  // averages over samples that have the relevant raw measurement (same
  // "average over what's available" convention as every other averageX
  // field above). averageMouthWidth is raw units (a scale-invariant ratio,
  // not yet 0-1 bounded) - normalized later in fusion-engine, same
  // convention as averageSharpness/averageAbsoluteYaw.
  averageMouthWidth: z.number().min(0).nullable(),
  averageCheekRaise: z.number().min(0).max(1).nullable(),
  averageEyeSquint: z.number().min(0).max(1).nullable(),
  // Fraction of "smiling" samples (average mouthSmileLeft/Right above a
  // threshold) that ALSO show both cheek-raise AND eye-squint above their
  // own thresholds - a coarse heuristic proxy for a GENUINE ("Duchenne")
  // smile/laugh, not a trained or validated classifier (see
  // deriveFaceLandmarkFeatures's own caveat for the exact thresholds, all
  // unvalidated guesses). Null when no sample ever crossed the smiling
  // threshold at all (not merely inconclusive).
  genuineSmileRate: z.number().min(0).max(1).nullable(),
  // AI Fusion roadmap's Face Intelligence initiative, Batch 5C (Blink & Eye
  // Behavior) - all three derived purely from data already collected since
  // Batch 1 (blink blendshapes) and Batch 2 (iris/eye-corner landmarks), no
  // new raw field/script change needed. See deriveFaceLandmarkFeatures's
  // own comments for exact formulas and honest caveats.
  //
  // Count of distinct blink EVENTS (transitions into a blink state) divided
  // by elapsed minutes between the first and last samples-with-blendshapes
  // - a genuinely different question from blinkRate (Batch 1, "what
  // fraction of sampled frames show a blink") - this asks "how many
  // separate blink events happened per minute". Null when fewer than 2
  // samples-with-blendshapes or elapsed time is 0.
  blinkFrequencyPerMinute: z.number().min(0).nullable(),
  // Count of blink runs (consecutive samples-with-blendshapes above
  // BLINK_THRESHOLD) whose length crosses PROLONGED_CLOSURE_MIN_SAMPLES -
  // given this pipeline's 1-sample/sec rate, a REAL blink (~100-400ms)
  // essentially never spans 2+ consecutive samples, so a multi-sample run
  // is read as sustained eye closure (e.g. resting/squinting), not a
  // normal blink - a coarse proxy, not a validated closure detector.
  prolongedClosureCount: z.number().int().min(0).nullable(),
  // 1 minus the normalized average frame-to-frame change in continuous
  // gaze offset (the same per-eye offset eyeGazeOffset() computes for
  // Batch 2's looking-direction bucket, but read continuously here rather
  // than bucketed) across consecutive samples-with-gaze-data - higher
  // means a more visually STEADY/consistent gaze, lower means more
  // wandering/wobbling eye movement. A genuinely computed motion-
  // consistency signal (same spirit as Batch 4.5's landmarkJitterScore,
  // applied to gaze instead of bounding-box position), though its
  // normalization cap is an unvalidated guess like every other cap here.
  gazeStabilityScore: z.number().min(0).max(1).nullable(),
  // AI Fusion roadmap's Face Intelligence initiative, Batch 5D (Emotion
  // Heuristic) - averageBrowActivity is a plain average of the 5 eyebrow
  // blendshapes' magnitude (raw 0-1 by contract, undirected - see
  // faceBlendshapesSchema's own comment). averageHeadMovementRate is raw
  // units (degrees/sec of combined pitch+yaw+roll change), derived from
  // the SAME rotation sequence Batch 1 already collects - no new raw
  // field needed, normalized later in fusion-engine.
  averageBrowActivity: z.number().min(0).max(1).nullable(),
  averageHeadMovementRate: z.number().min(0).nullable(),
  // Deliberately SAFE, non-diagnostic vocabulary - explicit user
  // instruction: "Jangan langsung mengklaim 'sedih' atau 'marah'" (don't
  // directly claim "sad" or "angry"). Combines Smile (Batch 1/5B) + Jaw/
  // Speaking (Batch 1/5A) + Eyebrow + Head movement (this batch) via a
  // simple deterministic decision tree - NOT a trained classifier, see
  // deriveFaceLandmarkFeatures's own caveat for the exact (unvalidated)
  // thresholds and priority order. Null when none of the contributing
  // signals were available at all.
  dominantAffect: z.enum(AFFECT_LABELS).nullable(),
  // Coarse "how much of the underlying signal was actually available"
  // coverage score (fraction of the 3 component scores - positivity/
  // energy/expressiveness - that had data) - explicitly NOT a statistical
  // confidence or model probability.
  affectConfidence: z.number().min(0).max(1).nullable(),
});

export const faceLandmarkSignalSchema = intelligenceSignalSchema(
  faceLandmarkSampleSchema,
  faceLandmarkFeaturesSchema,
);

export type DetectFaceLandmarksInput = z.infer<typeof detectFaceLandmarksInputSchema>;
export type NormalizedPoint3d = z.infer<typeof normalizedPoint3dSchema>;
export type FaceBlendshapes = z.infer<typeof faceBlendshapesSchema>;
export type FaceRotation = z.infer<typeof faceRotationSchema>;
export type FaceLandmarkSample = z.infer<typeof faceLandmarkSampleSchema>;
export type FaceLandmarkFeatures = z.infer<typeof faceLandmarkFeaturesSchema>;
export type FaceLandmarkSignal = z.infer<typeof faceLandmarkSignalSchema>;
