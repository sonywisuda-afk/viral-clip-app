import { featureVectorSchema, type FeatureVector } from '@speedora/contracts';

// Thin wrapper around featureVectorSchema.parse - throws with a clear
// message on a malformed FeatureVector rather than letting a bad shape
// propagate silently into training. Same "fail loud on unknown/bad shape"
// convention as v2's NORMALIZERS registry
// (packages/fusion-engine/src/feature-pipeline.ts), which throws rather
// than silently defaulting on an unrecognized feature name.
export function validateFeatureVector(input: unknown): FeatureVector {
  return featureVectorSchema.parse(input);
}
