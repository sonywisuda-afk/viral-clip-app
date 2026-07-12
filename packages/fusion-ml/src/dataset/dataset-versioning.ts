import type { DatasetVersion, TrainingSample } from '@speedora/contracts';
import { computeChecksum } from '../model-registry';
import { serializeModel } from '../model-serialization';

// Milestone 2B - a deterministic, content-checksummed identity for a set of
// TrainingSamples, feeding ModelMetadata.datasetVersion. Sorted by sampleId
// first so the same underlying dataset produces the same version
// regardless of the order samples were loaded/passed in - only the actual
// content (which samples, what labels/feature values) changes the version.
// `versionId` is the checksum's first 12 hex chars - short, still
// effectively collision-free for this purpose (same convention a git
// short-hash uses).
export function computeDatasetVersion(samples: TrainingSample[]): DatasetVersion {
  const sorted = [...samples].sort((a, b) => a.sampleId.localeCompare(b.sampleId));
  const checksum = computeChecksum(serializeModel(sorted));
  return {
    versionId: checksum.slice(0, 12),
    createdAt: new Date().toISOString(),
    sampleCount: samples.length,
    checksum,
  };
}
