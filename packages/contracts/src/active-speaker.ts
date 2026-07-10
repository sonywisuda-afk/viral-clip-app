import { z } from 'zod';
import { intelligenceSignalSchema } from './intelligence-signal';

// Speaker Intelligence roadmap, Level 1 - Active Speaker Detection, Speaker-
// Face Association, and Lip Sync Verification. All three are pure
// AGGREGATIONS over data other modules already collect (face-landmarks'
// jawOpen/trackId/boundingBox, audio-intelligence's rmsDb, voice-activity's
// speech segments, speaker-diarization's turns) - none of them is a new
// subprocess/detector, same "composite signal, no raw detector of its own"
// pattern @speedora/editing-rhythm already established for the Fusion
// Engine. No implementation exists yet - contracts-first, same precedent as
// voice-activity.ts.

// One sampled instant's "who is actually talking" decision - `activeTrackId`
// null means either no face was present, or none of the present faces'
// mouth movement correlated with concurrent speech audio strongly enough to
// call it. Distinct from face-landmarks' existing `speakerAudioSyncRate`
// (a single clip-wide rate, always scored against whichever ONE face the
// tracker followed) - this is a genuine per-instant, potentially
// multi-face-aware decision, the building block Face Intelligence's
// existing single-track heuristic would need multi-face tracking to produce.
export const activeSpeakerSampleSchema = z.object({
  t: z.number(),
  activeTrackId: z.number().int().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const detectActiveSpeakerOutputSchema = z.array(activeSpeakerSampleSchema);

export const activeSpeakerFeaturesSchema = z.object({
  dominantActiveTrackId: z.number().int().nullable(),
  // Fraction of samples with a face present where an active speaker was
  // confidently identified - "coverage", not correctness (no ground truth
  // exists to check against, same honesty as every other rate in this
  // pipeline).
  activeSpeakerCoverageRate: z.number().min(0).max(1).nullable(),
});

export const activeSpeakerSignalSchema = intelligenceSignalSchema(
  activeSpeakerSampleSchema,
  activeSpeakerFeaturesSchema,
);

// Speaker-Face Association - links a speaker-diarization label to the face
// trackId most consistently active while that speaker's turns were playing.
// `status: 'unknown'` (not a fabricated low-confidence match) covers the
// realistic case of an off-camera speaker, or a video with no reliable face
// tracking at all for that stretch.
export const SPEAKER_FACE_MATCH_STATUSES = ['matched', 'unknown'] as const;
export type SpeakerFaceMatchStatus = (typeof SPEAKER_FACE_MATCH_STATUSES)[number];

export const speakerFaceAssociationSchema = z.object({
  speaker: z.string(),
  faceTrackId: z.number().int().nullable(),
  status: z.enum(SPEAKER_FACE_MATCH_STATUSES),
  confidence: z.number().min(0).max(1),
});

export const associateSpeakersWithFacesOutputSchema = z.array(speakerFaceAssociationSchema);

// Lip Sync Verification - a stricter, per-track sibling of face-landmarks'
// existing `speakerAudioSyncRate` proxy: that field is a single clip-wide
// rate against whichever one face the (single-object) tracker followed;
// this is scoped per faceTrackId and adds an explicit estimated AV-offset
// reading, useful for podcast/interview/dubbing sync QA per the roadmap's
// own framing.
export const lipSyncVerificationSchema = z.object({
  faceTrackId: z.number().int(),
  // Reuses the same jawOpen-velocity measurement as
  // faceLandmarkFeaturesSchema.averageLipVelocity, scoped to just this track.
  lipMotionScore: z.number().min(0).max(1).nullable(),
  // Correlation between this track's mouth movement and concurrent audio
  // energy - the same underlying comparison as speakerAudioSyncRate, scoped
  // per-track instead of clip-wide.
  audioSyncScore: z.number().min(0).max(1).nullable(),
  // Estimated audio-video offset; positive = audio lags video. Null when
  // there isn't enough correlated data to estimate an offset at all (not
  // merely "zero offset").
  delayMs: z.number().nullable(),
  frameOffset: z.number().int().nullable(),
  // audioSyncScore above a threshold AND |delayMs| within tolerance - both
  // thresholds are unvalidated guesses, same honesty as every other
  // classification bucket in this pipeline. Null when inputs were
  // insufficient to evaluate at all.
  verified: z.boolean().nullable(),
});

export const verifyLipSyncOutputSchema = z.array(lipSyncVerificationSchema);

export type ActiveSpeakerSample = z.infer<typeof activeSpeakerSampleSchema>;
export type ActiveSpeakerFeatures = z.infer<typeof activeSpeakerFeaturesSchema>;
export type ActiveSpeakerSignal = z.infer<typeof activeSpeakerSignalSchema>;
export type SpeakerFaceAssociation = z.infer<typeof speakerFaceAssociationSchema>;
export type LipSyncVerification = z.infer<typeof lipSyncVerificationSchema>;
