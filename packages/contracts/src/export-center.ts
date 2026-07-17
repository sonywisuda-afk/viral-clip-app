import { z } from 'zod';

// Sprint 03a (Export Center roadmap) - packages/report-builder's whole
// input/output contract. Every leaf schema below mirrors an existing
// packages/shared shape rather than importing it, same reasoning
// clip-scoring.ts documents: a DB-agnostic contract package never depends
// on the DB-facing packages/shared, even though the two describe the same
// data by convention.

const fusionContributionSchema = z.object({
  signal: z.string(),
  feature: z.string(),
  rawValue: z.number().nullable(),
  normalizedValue: z.number(),
  weight: z.number(),
  weightedContribution: z.number(),
});

const fusionFactorSchema = z.object({
  signal: z.string(),
  feature: z.string(),
  weightedContribution: z.number(),
  description: z.string(),
});

const fusionPredictionSchema = z.object({
  bucket: z.enum(['likely_high_performer', 'uncertain', 'likely_low_performer']),
  rationale: z.string(),
});

const fusionRecommendationSchema = z.object({
  action: z.string(),
  message: z.string(),
});

// Mirrors FacialEmotionFeatures/OcrFeatures/AudioFeatures - pass-through
// data the report only displays, never recomputes.
const facialFeaturesSchema = z.object({
  dominantEmotion: z.string().nullable(),
  emotionTransitions: z.number(),
  peakConfidence: z.number().nullable(),
  stability: z.number().nullable(),
});

const ocrFeaturesSchema = z.object({
  subtitleCoverageRate: z.number().nullable(),
  slidePresenceRate: z.number().nullable(),
  captionRate: z.number().nullable(),
  logoPresenceRate: z.number().nullable(),
  priceMentionRate: z.number().nullable(),
  nameMentionRate: z.number().nullable(),
  dominantTextCategory: z.string().nullable(),
  averageTextBlockCount: z.number().nullable(),
});

const audioFeaturesSchema = z.object({
  averageRmsDb: z.number().nullable(),
  peakDb: z.number().nullable(),
  averageSpeakingRateWordsPerSecond: z.number().nullable(),
  speakingRateStdDev: z.number().nullable(),
});

// Only what the Speech Analysis section's vocal-emotion aggregation needs -
// deliberately narrower than the DB-hydrated TranscriptSegment (no
// text/words/timing), same convention as clip-scoring's own segment schema.
// The adapter is responsible for handing this module only the segments that
// overlap a given clip (mirrors detect-clips.worker.ts's filterSegmentsForClip
// use for emoji-suggester) - this module never does that filtering itself.
const reportSegmentSchema = z.object({
  emotion: z.string().optional(),
});

const timelineEventSchema = z.object({
  toStatus: z.string(),
  occurredAt: z.string(),
  errorMessage: z.string().nullable(),
});

// One clip, narrowed down to exactly what a video report's sections read -
// the adapter (built in 03c) is responsible for assembling this from a
// Clip DTO plus its own GET /clips/:id/explainability result plus its
// clip-scoped transcript segments.
const reportClipInputSchema = z.object({
  id: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  hookText: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  keywords: z.array(z.string()),
  hashtags: z.array(z.string()),
  topics: z.array(z.string()),
  intent: z.string().nullable(),
  // Straight reads of the already-computed detect-clips LLM output - never
  // re-derived here (see this module's own comments on why CTA Detection is
  // a pass-through, not a new detector).
  ctaText: z.string().nullable(),
  ctaStrength: z.number().nullable(),
  facialFeatures: facialFeaturesSchema.nullable(),
  ocrFeatures: ocrFeaturesSchema.nullable(),
  audioFeatures: audioFeaturesSchema.nullable(),
  segments: z.array(reportSegmentSchema),
  highlightScore: z.number().nullable(),
  highlightConfidence: z.number().nullable(),
  highlightReason: z.string().nullable(),
  highlightBreakdown: z.array(fusionContributionSchema),
  highlightTopFactors: z.array(fusionFactorSchema),
  highlightPrediction: fusionPredictionSchema.nullable(),
  highlightRecommendation: fusionRecommendationSchema.nullable(),
  highlightRank: z.number().nullable(),
});

export const buildVideoReportInputSchema = z.object({
  video: z.object({
    title: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    durationSeconds: z.number().nullable(),
  }),
  clips: z.array(reportClipInputSchema),
  statusEvents: z.array(timelineEventSchema).default([]),
});

// ---- output: one entry per section, each section listing every clip that
// has something to say for it, mirroring how a PDF actually reads (grouped
// by section, not one repeating block per clip). ----

const coverSectionSchema = z.object({
  videoTitle: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
});

const videoSummarySectionSchema = z.object({
  durationSeconds: z.number().nullable(),
  clipCount: z.number(),
  averageHighlightScore: z.number().nullable(),
});

const timelineSectionSchema = z.object({
  events: z.array(timelineEventSchema),
});

const highlightEntrySchema = z.object({
  clipId: z.string(),
  highlightScore: z.number().nullable(),
  highlightConfidence: z.number().nullable(),
  highlightReason: z.string().nullable(),
  breakdown: z.array(fusionContributionSchema),
  topFactors: z.array(fusionFactorSchema),
  prediction: fusionPredictionSchema.nullable(),
  recommendation: fusionRecommendationSchema.nullable(),
  highlightRank: z.number().nullable(),
});
const highlightSectionSchema = z.object({ entries: z.array(highlightEntrySchema) });

const topMomentSchema = z.object({
  clipId: z.string(),
  hookText: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  highlightScore: z.number().nullable(),
  highlightRank: z.number().nullable(),
});
const topMomentsSectionSchema = z.object({ moments: z.array(topMomentSchema) });

const faceAnalysisEntrySchema = z.object({
  clipId: z.string(),
  features: facialFeaturesSchema.nullable(),
});
const faceAnalysisSectionSchema = z.object({ entries: z.array(faceAnalysisEntrySchema) });

const vocalEmotionDistributionSchema = z.object({
  dominantEmotion: z.string().nullable(),
  counts: z.record(z.string(), z.number()),
});
const speechAnalysisEntrySchema = z.object({
  clipId: z.string(),
  audioFeatures: audioFeaturesSchema.nullable(),
  vocalEmotion: vocalEmotionDistributionSchema,
});
const speechAnalysisSectionSchema = z.object({ entries: z.array(speechAnalysisEntrySchema) });

const ocrSummaryEntrySchema = z.object({
  clipId: z.string(),
  features: ocrFeaturesSchema.nullable(),
});
const ocrSummarySectionSchema = z.object({ entries: z.array(ocrSummaryEntrySchema) });

const keywordEntrySchema = z.object({
  clipId: z.string(),
  keywords: z.array(z.string()),
  hashtags: z.array(z.string()),
  topics: z.array(z.string()),
});
const keywordSectionSchema = z.object({ entries: z.array(keywordEntrySchema) });

const ctaEntrySchema = z.object({
  clipId: z.string(),
  ctaText: z.string().nullable(),
  ctaStrength: z.number().nullable(),
});
const ctaSectionSchema = z.object({ entries: z.array(ctaEntrySchema) });

const thumbnailEntrySchema = z.object({
  clipId: z.string(),
  thumbnailUrl: z.string().nullable(),
});
const thumbnailSectionSchema = z.object({ entries: z.array(thumbnailEntrySchema) });

export const videoReportDataSchema = z.object({
  cover: coverSectionSchema,
  videoSummary: videoSummarySectionSchema,
  timeline: timelineSectionSchema,
  highlight: highlightSectionSchema,
  topMoments: topMomentsSectionSchema,
  faceAnalysis: faceAnalysisSectionSchema,
  speechAnalysis: speechAnalysisSectionSchema,
  ocrSummary: ocrSummarySectionSchema,
  keyword: keywordSectionSchema,
  cta: ctaSectionSchema,
  thumbnail: thumbnailSectionSchema,
});

// ---- Clip Metadata - a separate, simpler export format (existing Clip DTO
// fields only, field selection rather than section-shaping). ----

const clipMetadataClipInputSchema = z.object({
  id: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  hookText: z.string().nullable(),
  hashtags: z.array(z.string()),
  keywords: z.array(z.string()),
  topics: z.array(z.string()),
  intent: z.string().nullable(),
  ctaText: z.string().nullable(),
  highlightScore: z.number().nullable(),
  highlightRank: z.number().nullable(),
  scores: z.record(z.string(), z.number()).nullable(),
});

export const clipMetadataInputSchema = z.object({
  clips: z.array(clipMetadataClipInputSchema),
});

const clipMetadataEntrySchema = z.object({
  clipId: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  hookText: z.string().nullable(),
  hashtags: z.array(z.string()),
  keywords: z.array(z.string()),
  topics: z.array(z.string()),
  intent: z.string().nullable(),
  ctaText: z.string().nullable(),
  highlightScore: z.number().nullable(),
  highlightRank: z.number().nullable(),
  scores: z.record(z.string(), z.number()).nullable(),
});

export const clipMetadataOutputSchema = z.object({
  clips: z.array(clipMetadataEntrySchema),
});

export type ReportClipInput = z.infer<typeof reportClipInputSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type BuildVideoReportInput = z.infer<typeof buildVideoReportInputSchema>;
export type VideoReportData = z.infer<typeof videoReportDataSchema>;
export type CoverSection = z.infer<typeof coverSectionSchema>;
export type VideoSummarySection = z.infer<typeof videoSummarySectionSchema>;
export type TimelineSection = z.infer<typeof timelineSectionSchema>;
export type HighlightSection = z.infer<typeof highlightSectionSchema>;
export type TopMomentsSection = z.infer<typeof topMomentsSectionSchema>;
export type FaceAnalysisSection = z.infer<typeof faceAnalysisSectionSchema>;
export type SpeechAnalysisSection = z.infer<typeof speechAnalysisSectionSchema>;
export type OcrSummarySection = z.infer<typeof ocrSummarySectionSchema>;
export type KeywordSection = z.infer<typeof keywordSectionSchema>;
export type CtaSection = z.infer<typeof ctaSectionSchema>;
export type ThumbnailSection = z.infer<typeof thumbnailSectionSchema>;
export type ClipMetadataInput = z.infer<typeof clipMetadataInputSchema>;
export type ClipMetadataOutput = z.infer<typeof clipMetadataOutputSchema>;
