import { z } from 'zod';

// Speaker Intelligence roadmap, Level 3 (product differentiation). Every
// score below is a deterministic composite over ALREADY-computed features
// from other modules (face-landmarks/gesture/audio/diarization/active-
// speaker) - none is a new raw detector. Same "heuristic, unvalidated
// against real engagement data until calibrated" honesty as the Fusion
// Engine itself (see ai/fusion.md and this repo's editingRhythm weight-
// calibration precedent). These sit ALONGSIDE the existing per-clip Fusion
// Engine, feeding it as a `speaker` signal (see speakerFusionFeaturesSchema
// below) rather than replacing it.
//
// Milestone C (@speedora/speaker-scoring) implemented deriving functions
// for speakerConfidenceScoreSchema/speakerEngagementScoreSchema/
// speakerImportanceScoreSchema/speakerHighlightMomentSchema.
// speakerAttentionScoreSchema and rankedSpeakerMomentSchema remain
// contracts-only below - no deriving function exists for either yet.

export const speakerConfidenceScoreSchema = z.object({
  speakerId: z.string(),
  eyeContactRate: z.number().min(0).max(1).nullable(),
  // Inverse-normalized form of face-landmarks' averageHeadMovementRate -
  // steadier head = higher score.
  headPoseStability: z.number().min(0).max(1).nullable(),
  // From gesture-intelligence's stability/peakConfidence.
  gestureActivity: z.number().min(0).max(1).nullable(),
  // Inverse-normalized form of audio-intelligence's speakingRateStdDev -
  // steadier pacing = higher score.
  voiceStability: z.number().min(0).max(1).nullable(),
  speakingRateScore: z.number().min(0).max(1).nullable(),
  overallScore: z.number().min(0).max(1).nullable(),
});

// `role` is an explicit input, NOT something this schema infers - no
// detector in this codebase can tell "host" from "guest" from "audience" on
// its own; a caller (manual tagging, publish metadata, etc.) supplies it.
// Role inference itself is out of scope for now - see the roadmap doc.
export const SPEAKER_ROLES = ['host', 'guest', 'audience', 'unknown'] as const;
export type SpeakerRole = (typeof SPEAKER_ROLES)[number];

export const speakerImportanceScoreSchema = z.object({
  speakerId: z.string(),
  role: z.enum(SPEAKER_ROLES).nullable(),
  talkTimeRatio: z.number().min(0).max(1).nullable(),
  screenTimeRatio: z.number().min(0).max(1).nullable(),
  score: z.number().min(0).max(100).nullable(),
});

export const speakerEngagementScoreSchema = z.object({
  speakerId: z.string(),
  gestureScore: z.number().min(0).max(1).nullable(),
  voiceEnergyScore: z.number().min(0).max(1).nullable(),
  facialExpressionScore: z.number().min(0).max(1).nullable(),
  speakingRateScore: z.number().min(0).max(1).nullable(),
  overallScore: z.number().min(0).max(1).nullable(),
});

export const speakerAttentionScoreSchema = z.object({
  speakerId: z.string(),
  motionScore: z.number().min(0).max(1).nullable(),
  gestureScore: z.number().min(0).max(1).nullable(),
  eyeContactRate: z.number().min(0).max(1).nullable(),
  faceSizeScore: z.number().min(0).max(1).nullable(),
  overallScore: z.number().min(0).max(1).nullable(),
});

// Speaker Highlight Score - a per-speaker-moment analog of the Fusion
// Engine's clip-level highlightScore (ai/fusion.md). `hookStrength` reuses
// clip-scoring's LLM-derived metric when the moment falls inside a scored
// clip - NOT re-derived here. See "Adaptive Highlight Scoring" in the
// roadmap doc for the open question of exactly how a per-speaker-moment
// score and the existing per-clip highlightScore are meant to combine.
export const speakerHighlightMomentSchema = z.object({
  speakerId: z.string(),
  start: z.number(),
  end: z.number(),
  isActiveSpeaker: z.boolean().nullable(),
  emotionIntensity: z.number().min(0).max(1).nullable(),
  gestureIntensity: z.number().min(0).max(1).nullable(),
  eyeContactRate: z.number().min(0).max(1).nullable(),
  hookStrength: z.number().min(0).max(100).nullable(),
  score: z.number().min(0).max(100).nullable(),
});

// Speaker-Centric Clip Ranking - ranks speakerHighlightMomentSchema entries
// (candidate MOMENTS, not whole clips - contrast with fusion.ts's
// rankedClipSchema, which ranks already-rendered clips for a video) so a
// caller can ask "what's this speaker's best moment across the video."
export const rankedSpeakerMomentSchema = z.object({
  speakerId: z.string(),
  start: z.number(),
  end: z.number(),
  score: z.number().min(0).max(100).nullable(),
  rank: z.number().int().positive(),
});

// Speaker Intelligence roadmap, Milestone D - the shape
// @speedora/fusion-engine consumes as its `speaker` FUSION_SIGNALS entry
// (see fusion.ts), mirroring how editingRhythm's composite features are
// consumed. Deliberately narrower than an earlier draft of this schema: it
// used to also carry `dominantSpeakerAttention` (Speaker Attention Score)
// and `conversationType` (Conversation Type Classification) - both
// speculative Level 3 items with NO deriving function ever implemented
// (see speakerAttentionScoreSchema above, still unused by anything, and
// conversation-intelligence.ts). Wiring null-forever fields into the
// Fusion Engine would be indistinguishable from a real "not available for
// this clip" null and just add dead weight - dropped rather than kept as
// permanent scaffolding. `dominantSpeaker*` means the score belonging to
// whichever speaker in the clip has the highest speakerImportanceScore
// (same "dominant X" naming convention as dominantEmotion/dominantGesture
// elsewhere in this pipeline) - see @speedora/speaker-scoring's
// deriveSpeakerFusionFeatures.
export const speakerFusionFeaturesSchema = z.object({
  dominantSpeakerConfidence: z.number().min(0).max(1).nullable(),
  dominantSpeakerEngagement: z.number().min(0).max(1).nullable(),
  dominantSpeakerImportance: z.number().min(0).max(1).nullable(),
  // Average of speakerHighlightMomentSchema.score across every turn in the
  // clip (already 0-100, normalized to 0-1 here to match every other field
  // in this object) - the Highlight Score signal, at the clip-summary
  // grain the Fusion Engine actually consumes (a single moment-level score
  // has no clip-level meaning on its own).
  averageSpeakerHighlightScore: z.number().min(0).max(1).nullable(),
});

export type SpeakerConfidenceScore = z.infer<typeof speakerConfidenceScoreSchema>;
export type SpeakerImportanceScore = z.infer<typeof speakerImportanceScoreSchema>;
export type SpeakerEngagementScore = z.infer<typeof speakerEngagementScoreSchema>;
export type SpeakerAttentionScore = z.infer<typeof speakerAttentionScoreSchema>;
export type SpeakerHighlightMoment = z.infer<typeof speakerHighlightMomentSchema>;
export type RankedSpeakerMoment = z.infer<typeof rankedSpeakerMomentSchema>;
export type SpeakerFusionFeatures = z.infer<typeof speakerFusionFeaturesSchema>;
