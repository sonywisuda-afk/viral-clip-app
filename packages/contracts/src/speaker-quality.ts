import { z } from 'zod';

// Speaker Intelligence roadmap, Level 2 - Speaker Quality Score and Speaker
// Visibility. Both are pure ROLLUPS of measurements
// @speedora/facial-intelligence already computes per faceLandmarkSample
// (boundingBox, rotation, sharpness, brightness, occlusionRate,
// eyeContactRate - see face-landmarks.ts) - no new raw signal, purely a
// coarser, product-facing classification/composite layer. Contracts-first,
// no deriving function implemented yet.

export const SPEAKER_VISIBILITY_STATES = [
  'full_face',
  'half_face',
  'hidden',
  'back_view',
  'side_view',
] as const;
export type SpeakerVisibilityState = (typeof SPEAKER_VISIBILITY_STATES)[number];

// null state means no face was detected in this sampled frame at all
// (distinct from 'hidden', which means a face WAS detected/tracked but is
// substantially occluded) - same null-vs-category distinction as every
// other classification in this pipeline.
export const speakerVisibilitySampleSchema = z.object({
  t: z.number(),
  state: z.enum(SPEAKER_VISIBILITY_STATES).nullable(),
});

export const classifySpeakerVisibilityOutputSchema = z.array(speakerVisibilitySampleSchema);

// A single "at a glance" composite, same "arbitrary display rollup, not a
// calibrated model" honesty as face-tracking-quality.ts's
// trackingConfidence. sharpnessScore/lightingScore are the NORMALIZED [0,1]
// forms of face-landmarks' raw `sharpness`/`brightness` (which are
// Laplacian-variance/0-255 units respectively) - normalization happens here,
// not in facial-intelligence, since it's this rollup's own presentation
// concern.
export const speakerQualityScoreSchema = z.object({
  faceTrackId: z.number().int().nullable(),
  visibilityScore: z.number().min(0).max(1).nullable(),
  sizeScore: z.number().min(0).max(1).nullable(),
  sharpnessScore: z.number().min(0).max(1).nullable(),
  lightingScore: z.number().min(0).max(1).nullable(),
  eyeContactRate: z.number().min(0).max(1).nullable(),
  // Unweighted average of whichever components above are non-null.
  overallScore: z.number().min(0).max(1).nullable(),
});

export type SpeakerVisibilitySample = z.infer<typeof speakerVisibilitySampleSchema>;
export type SpeakerQualityScore = z.infer<typeof speakerQualityScoreSchema>;
