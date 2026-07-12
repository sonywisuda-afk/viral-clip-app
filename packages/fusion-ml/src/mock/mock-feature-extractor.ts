import type { FeatureVector } from '@speedora/contracts';
import { FUSION_V3_SIGNALS } from '@speedora/contracts';
import type { FeatureExtractor } from '../interfaces';

// The one FeatureExtractor implementation this milestone ships - a
// deterministic function of clipId (not a global counter, unlike
// loadMockDataset()'s sample-index seed), so calling extract() twice for
// the same clipId always returns the same values. A real implementation
// would bridge a real clip's already-computed AI signals into this shape
// (see interfaces.ts's FeatureExtractor comment) - this one has no data
// source at all, by design.
export class MockFeatureExtractor implements FeatureExtractor {
  async extract(clipId: string): Promise<FeatureVector> {
    const seedBase = [...clipId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const values = FUSION_V3_SIGNALS.map((_, i) => Math.abs(Math.sin(seedBase + i * 7)));
    return {
      clipId,
      featureNames: [...FUSION_V3_SIGNALS],
      values,
      extractedAt: new Date().toISOString(),
    };
  }
}
