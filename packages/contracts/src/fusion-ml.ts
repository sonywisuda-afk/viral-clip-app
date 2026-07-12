import { z } from 'zod';
import type { FusionSignal } from './fusion';

// Milestone 2A (Fusion Engine v3 Foundation) - see docs/ai/fusion-v3.md.
// v2 (packages/fusion-engine, this file's sibling `fusion.ts`) remains the
// only engine actually running in production; nothing here has a caller in
// apps/worker/apps/api yet. These contracts exist so packages/fusion-ml's
// interfaces (FeatureExtractor/DatasetBuilder/ModelTrainer/ModelEvaluator/
// Predictor) have a stable, versioned shape to agree on ahead of any real ML
// implementation - the same "define the contract before the consumer that
// implements it" precedent ARCHITECTURE.md documents for v1 of this engine.
//
// v3's feature-signal set is a deliberate 8-signal subset of v2's 13
// FUSION_SIGNALS (given by explicit user direction), NOT a replacement for
// it - omits sceneMotion/faceGeometry/object/llm/editingRhythm. This is its
// own ordered tuple, kept separate from `fusion.ts`'s FUSION_SIGNALS rather
// than derived from it, since v3 isn't required to mirror v2's set.
export const FUSION_V3_SIGNALS = [
  'audio',
  'scene',
  'ocr',
  'emotion',
  'gesture',
  'composition',
  'speaker',
  'cameraMotion',
] as const;
export type FusionV3Signal = (typeof FUSION_V3_SIGNALS)[number];

// Milestone 2B - v3's 8 signals don't share v2's FUSION_SIGNALS names 1:1.
// `facial` (v2, expression classification via a separate ViT model) ->
// `emotion` (v3's own naming, per explicit user direction on the 8-signal
// list) is the one real rename; every other key maps to itself. Used by
// apps/worker's ProductionDatasetBuilder to bridge a v2-shaped
// DatasetRecord (apps/worker/src/scripts/dataset-lib.ts) into a v3
// FeatureVector - packages/fusion-ml itself never touches this map, since
// it has no DatasetRecord-shaped input to bridge from.
export const FUSION_V2_TO_V3_SIGNAL_MAP: Partial<Record<FusionSignal, FusionV3Signal>> = {
  audio: 'audio',
  scene: 'scene',
  ocr: 'ocr',
  facial: 'emotion',
  gesture: 'gesture',
  composition: 'composition',
  speaker: 'speaker',
  cameraMotion: 'cameraMotion',
};

// A dense, ordered numeric vector - deliberately flat rather than the
// nested per-signal shape fusionInputSchema uses, because it mirrors
// Milestone 1.5's DatasetRecord (apps/worker/src/scripts/dataset-lib.ts):
// { clipId, [featureKey]: number }. A real FeatureExtractor implementation
// bridging DatasetRecord -> FeatureVector is a reshape, not a redesign.
// `featureNames[i]` names `values[i]` - the two arrays must stay the same
// length (enforced below) since a real training pipeline needs a STABLE
// feature ordering between training and inference, not just named keys.
export const featureVectorSchema = z
  .object({
    clipId: z.string(),
    featureNames: z.array(z.string()),
    values: z.array(z.number()),
    extractedAt: z.string(),
  })
  .refine((v) => v.featureNames.length === v.values.length, {
    message: 'featureNames and values must be the same length',
  });
export type FeatureVector = z.infer<typeof featureVectorSchema>;

// One row of a training dataset - a FeatureVector plus the real-world
// outcome it's trying to predict. `label` is deliberately a bare number,
// not tied to any one metric's name - Milestone 1's engagementScore is the
// obvious first choice (see docs/ai/dataset-feedback-loop.md) but this
// contract doesn't hardcode that assumption.
export const trainingSampleSchema = z.object({
  sampleId: z.string(),
  featureVector: featureVectorSchema,
  label: z.number(),
});
export type TrainingSample = z.infer<typeof trainingSampleSchema>;

// A single prediction for one clip. `confidence` is nullable (unlike v2's
// fusionOutputSchema.confidence, which is always a number) because a real
// v3 model isn't guaranteed to produce a confidence signal at all -
// null means genuinely unavailable, not a fabricated 0.
export const predictionResultSchema = z.object({
  clipId: z.string(),
  score: z.number(),
  confidence: z.number().min(0).max(1).nullable(),
  modelVersion: z.string(),
});
export type PredictionResult = z.infer<typeof predictionResultSchema>;

// A batch of predictions turned into a ranking, same "ranking is a separate
// stage from scoring one clip in isolation" reasoning as v2's
// rankedClipSchema (fusion.ts) - kept as its own top-level contract (not
// just PredictionResult[]) so `modelVersion` is recorded once per batch,
// not repeated per row.
export const rankingResultSchema = z.object({
  modelVersion: z.string(),
  rankings: z.array(
    z.object({
      clipId: z.string(),
      rank: z.number().int().positive(),
      score: z.number(),
    }),
  ),
});
export type RankingResult = z.infer<typeof rankingResultSchema>;

// Model versioning metadata - the exact field list given by explicit user
// direction (Model/Created/Dataset Version/Feature Version/Training
// Samples/Evaluation Score/Checksum), mapped to camelCase. `checksum` is a
// real sha256 of the serialized model (see packages/fusion-ml's
// computeChecksum), not a placeholder - lets a ModelRegistry catch a
// corrupted/tampered artifact on load. See docs/ai/fusion-v3.md's "Model
// versioning" section for the models/fusion/v{n}/ key convention this
// metadata is stored alongside.
export const modelMetadataSchema = z.object({
  modelId: z.string(),
  modelVersion: z.string(),
  createdAt: z.string(),
  datasetVersion: z.string(),
  featureVersion: z.string(),
  trainingSampleCount: z.number().int().nonnegative(),
  evaluationScore: z.number().nullable(),
  checksum: z.string(),
});
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

// Milestone 2B - a deterministic, content-checksummed identity for a set of
// TrainingSamples, feeding ModelMetadata.datasetVersion. Not a registry of
// its own (unlike FeatureSchema/ModelMetadata below) - just a value,
// computed fresh each time from whatever samples were actually used
// (packages/fusion-ml's computeDatasetVersion).
export const datasetVersionSchema = z.object({
  versionId: z.string(),
  createdAt: z.string(),
  sampleCount: z.number().int().nonnegative(),
  checksum: z.string(),
});
export type DatasetVersion = z.infer<typeof datasetVersionSchema>;

// Milestone 2B - the definitive ordered feature-name list a FeatureVector
// was built against, registered so ModelMetadata.featureVersion resolves
// back to something concrete (packages/fusion-ml's FeatureRegistry). Unlike
// FUSION_V3_SIGNALS (the 8 SIGNAL categories), `featureNames` here is the
// full list of individual named features actually observed within those
// signals (e.g. `audio.averageRmsDb`) - which named features exist per
// signal isn't fixed by this contract, since it depends on whatever v2
// detectors happened to produce data for a given batch of clips.
export const featureSchemaSchema = z.object({
  featureVersion: z.string(),
  featureNames: z.array(z.string()),
  createdAt: z.string(),
});
export type FeatureSchema = z.infer<typeof featureSchemaSchema>;
