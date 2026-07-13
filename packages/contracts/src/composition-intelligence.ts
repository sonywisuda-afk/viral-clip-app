import { z } from 'zod';

// Composition Intelligence roadmap, Batch RB-1 (see docs/ai/composition-
// intelligence.md) - answers HOW THE SUBJECT IS PLACED within the frame
// (rule of thirds, headroom, lead room, centering, and whether that
// placement stays consistent over a clip), as opposed to `scene-
// intelligence` (how the CAMERA moved) or `object-intelligence`/`facial-
// intelligence` (detecting/tracking the entities themselves). Named
// "Composition", not "Camera", because the underlying geometry (a bounding
// box's position relative to frame bounds) is agnostic to whether that box
// came from a live camera pan, Smart Reframe's AI crop, or a static
// thumbnail - see the roadmap doc's "Why Composition, not Camera" framing.
//
// A COMPOSITE signal, not a raw detector, same architectural shape as
// @speedora/editing-rhythm: its input is OTHER modules' already-computed
// per-frame bounding boxes (Facial Intelligence's face `boundingBox`,
// Object Intelligence's `ObjectTrack.boundingBox`), not a fresh subprocess/
// ffmpeg/model call of its own. Reclassified out of an earlier 15-batch
// "Camera Intelligence" proposal - 9 of those items turned out to already
// be Scene/Motion/Object Intelligence under a camera-flavored name, and 3
// more belong to a separate, not-yet-scoped Video Quality Intelligence
// roadmap. This file covers only what survived as genuinely new: RB-1.

// One sampled frame's worth of subject-placement input. Deliberately NOT a
// new detection - the caller (worker orchestrator) passes through whichever
// already-computed primary-subject box it has for this timestamp. Null
// across every field means "no subject detected in this sampled frame" (a
// real absence - this IS the raw signal `subjectLossRatio` is computed
// from), same "null is a real result, not an error" convention as
// faceLandmarkSampleSchema.
//
// PRIMARY SUBJECT SELECTION HAPPENS ENTIRELY OUTSIDE THIS PACKAGE. Every
// field below describes an ALREADY-CHOSEN subject - Composition Intelligence
// never performs subject detection, tracking, or selection itself, only
// derives spatial metrics from whatever it's handed. This boundary is
// deliberate (same "reuse, never recompute" rule as the rest of this
// module) and worth stating explicitly, because without a documented
// selection order two engineers wiring the worker orchestrator could
// reasonably build two different answers to "which subject". The order,
// first candidate that exists wins for that sampled frame:
//   1. Active speaker (once Speaker Intelligence's Active Speaker Detection
//      ships - contracts-only today, see docs/ai/speaker-intelligence.md)
//   2. Largest visible face (Facial Intelligence)
//   3. Largest tracked person (Object Intelligence, category === 'person')
//   4. Highest objectAttentionScore (Object Intelligence, Batch OI-5)
//   5. Largest tracked object (Object Intelligence, any category)
export const compositionSampleSchema = z.object({
  t: z.number(),
  // Normalized [0, 1] bounding box, same shape/convention as face-
  // landmarks.ts's boundingBox / object-intelligence's boundingBox - kept
  // as a plain re-declaration here rather than importing either schema, so
  // this module has zero code dependency on facial-intelligence/object-
  // intelligence (matches @speedora/editing-rhythm's "depend on
  // @speedora/contracts only" precedent - see the roadmap doc's package-
  // placement note).
  subjectBox: z
    .object({
      xCenter: z.number(),
      yCenter: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  // Track identity of whichever subject produced subjectBox this frame - a
  // Facial Intelligence trackId or an ObjectTrack.trackId, package-agnostic
  // (this module doesn't care which kind, just that it's a stable number
  // across samples). Not consumed by any RB-1 feature today - reserved so a
  // future multi-subject composition extension (see docs/ai/composition-
  // intelligence.md's "Future Extensions") can tell Track A apart from
  // Track B without a schema-breaking change later. Null whenever
  // subjectBox is null, or the caller has no track identity to give.
  subjectTrackId: z.number().int().nullable(),
  // Subject HEADING in degrees, reused directly from Face Landmarks Batch
  // 1's faceRotationSchema.yaw when the subject is a tracked face (0 =
  // looking straight at the camera) - used for leadRoomScore's "which side
  // of the frame should have more space" read. Deliberately heading, NOT
  // motion direction - lead room in composition means space in front of
  // where the subject is FACING, not where their bounding box happens to be
  // moving. yaw is used because it's the best already-available proxy: this
  // pipeline has no eye-gaze, body-pose, or walking-direction signal to
  // draw on instead. Null when the subject this frame is a non-face object
  // track, or facing data simply isn't available - leadRoomScore falls back
  // to the subjectBox's own recent horizontal displacement trend across
  // nearby samples in that case (no extra input field needed for that
  // fallback, it's computed from subjectBox alone by the not-yet-built
  // derive function).
  facingYaw: z.number().nullable(),
});
export type CompositionSample = z.infer<typeof compositionSampleSchema>;

export const compositionInputSchema = z.object({
  // Clip-level, not per-sample - a source video's frame dimensions don't
  // change mid-clip, so repeating this on every compositionSampleSchema
  // entry would be pure redundancy (same "clip-level scalar, not per-
  // sample" shape as editingRhythmInputSchema.clipDurationSeconds). NOT
  // needed to interpret subjectBox, which is already normalized [0, 1] -
  // resolution changes (1080p/720p/4K) are already fully absorbed by that
  // normalization on their own. The one real use is ASPECT RATIO
  // (width / height): a portrait 9:16 short clip and a landscape 16:9
  // source plausibly want different headroom/thirds target ranges, and
  // aspect ratio is the only thing that tells the derive function which
  // regime it's in. Null when the caller genuinely doesn't have it - every
  // RB-1 feature still degrades to orientation-agnostic thresholds in that
  // case, it just can't be orientation-aware.
  frameSize: z.object({ width: z.number().positive(), height: z.number().positive() }).nullable(),
  samples: z.array(compositionSampleSchema),
});
export type CompositionInput = z.infer<typeof compositionInputSchema>;

// Derived summary - the dense per-clip numbers the Fusion Engine will
// eventually consume once Batch RB-2 wires a `composition` FUSION_SIGNALS
// key (see docs/ai/composition-intelligence.md's RB-2 section - deliberately
// a NEW key, not a reuse of the existing `cameraMotion` key, which is
// already populated by Scene Intelligence's Batch SC-3 and answers a
// different question). All nullable, same "null means never computable,
// a real 0/1 is a meaningful value" convention as
// @speedora/contracts' editingRhythmFeaturesSchema/objectFeaturesSchema.
export const compositionFeaturesSchema = z.object({
  // Mean closeness of the subject's bounding-box center to the nearest
  // rule-of-thirds intersection point, across samples WITH a subjectBox
  // (frames with no subject are excluded, not scored 0 - a true "no
  // reading" rather than a penalty). Null when zero samples ever had a
  // subjectBox.
  ruleOfThirdsScore: z.number().min(0).max(1).nullable(),
  // Mean score for space above the subject's bounding box against a target
  // range (too little = cramped, too much = subject reads too small) -
  // same exclusion/null convention as ruleOfThirdsScore.
  headroomScore: z.number().min(0).max(1).nullable(),
  // Mean score for space in the direction the subject is facing/moving
  // (see compositionSampleSchema.facingYaw) - same exclusion/null
  // convention as ruleOfThirdsScore. Deliberately a separate field from
  // headroomScore/ruleOfThirdsScore rather than folded in - the three
  // answer genuinely different composition questions and are kept
  // independently explainable, same "domains, not one opaque blend"
  // reasoning as object-intelligence.ts's Visibility/Activity/Social split.
  leadRoomScore: z.number().min(0).max(1).nullable(),
  // Mean distance of the subject's bounding-box center from true
  // frame-center, normalized [0, 1] (1 = dead center) - the simplest of
  // the four placement scores, and deliberately NOT blended with
  // ruleOfThirdsScore even though a well-composed off-center subject
  // scores high on one and low on the other by design - keeping both
  // separate lets a caller tell "centered" apart from "well-composed but
  // intentionally off-center". Same exclusion/null convention as
  // ruleOfThirdsScore.
  centeringScore: z.number().min(0).max(1).nullable(),
  // Fraction of ALL samples (not just the ones with a subjectBox) where
  // subjectBox was null - "how much of the clip did the camera fail to
  // keep any subject in frame". A framing-failure read, distinct in
  // INTENT from object-intelligence.ts's averageTrackingConfidence (a
  // tracker-robustness read), even though both are ultimately computed
  // from the same underlying per-frame presence data. Null only when there
  // are zero samples at all (nothing to compute a ratio over) - a real 0
  // (subject visible every sample) or 1 (never visible) is a meaningful
  // value, not "unknown".
  subjectLossRatio: z.number().min(0).max(1).nullable(),
  // Composition Stability is computed from FRAME-TO-FRAME CHANGES in
  // composition, not absolute composition values - same shape as Scene
  // Intelligence's smoothnessScore, which is also a |Δdx| + |Δdy| delta
  // rather than an absolute reading. This is the whole reason the field
  // exists as a delta rather than a variance-of-the-raw-score: a clip with
  // ruleOfThirdsScore readings of [0.8, 0.8, 0.8] and one with
  // [0.6, 1.0, 0.6, 1.0] can average to the identical 0.8, yet the second
  // is visibly worse framing (oscillating rather than held) - only a
  // frame-to-frame delta, not the average, tells them apart. Null when
  // fewer than 2 consecutive samples both have a subjectBox (nothing to
  // take a delta between).
  compositionStability: z.number().min(0).nullable(),
  // Rate of shot-type transitions (close-up <-> medium <-> wide) per
  // minute of clip duration, from a coarse shotType bucket derived from
  // subjectBox area relative to the frame - the one piece of genuinely new
  // (if small) bucketing logic RB-1 needs, thresholded the same way Scene
  // Intelligence already buckets continuous camera-transform values into
  // dominantMotionType. No new detector either way - still built entirely
  // from subjectBox, which this module already receives.
  //
  // A shot-type CHANGE is not automatically bad - cutting from wide to
  // medium to close-up is often deliberate, intentional editing. This
  // field measures OSCILLATION FREQUENCY / apparently-unnecessary
  // reframing (rapid back-and-forth transitions within a short span), not
  // shot-type diversity itself - it must never be read as "fewer shot
  // types = better", only as "how much back-and-forth reframing happened",
  // so deliberate wide/medium/close-up editing isn't penalized just for
  // using more than one shot type. Null when fewer than 2 samples have a
  // subjectBox (nothing to compare transitions against).
  framingConsistency: z.number().nonnegative().nullable(),
});
export type CompositionFeatures = z.infer<typeof compositionFeaturesSchema>;
