import type { TrainingSample } from '@speedora/contracts';
import type { DatasetBuilder, FeatureExtractor } from '../interfaces';
import { MockFeatureExtractor } from './mock-feature-extractor';

// The one DatasetBuilder implementation this milestone ships - composes a
// FeatureExtractor (injected via the constructor, defaulting to
// MockFeatureExtractor - ARCHITECTURE.md's dependency-injection philosophy,
// so a real DatasetBuilder implementation could reuse this same class with
// a real extractor swapped in) with a simple label derived from the
// feature vector itself, since there's no real engagement outcome to label
// against yet.
export class MockDatasetBuilder implements DatasetBuilder {
  constructor(private readonly extractor: FeatureExtractor = new MockFeatureExtractor()) {}

  async build(sampleIds: string[]): Promise<TrainingSample[]> {
    const samples: TrainingSample[] = [];
    for (const clipId of sampleIds) {
      const featureVector = await this.extractor.extract(clipId);
      const label =
        featureVector.values.length === 0
          ? 0
          : featureVector.values.reduce((sum, v) => sum + v, 0) / featureVector.values.length;
      samples.push({ sampleId: `sample-${clipId}`, featureVector, label });
    }
    return samples;
  }
}
