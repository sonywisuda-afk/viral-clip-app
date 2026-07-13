import type { FeatureVector, FusionInput, PredictionResult } from '@speedora/contracts';
import { computeHighlightScore } from '@speedora/fusion-engine';
import type { Predictor } from '../interfaces';

const FALLBACK_MODEL_VERSION = 'mock-v3-baseline';

// The one Predictor implementation this milestone ships. When a real v2
// FusionInput fixture is available for a clip (injected at construction
// time, keyed by clipId - ARCHITECTURE.md's "deps injected by the caller"
// philosophy, applied at the class level since this is a stateful lookup
// rather than a per-call value), it genuinely calls @speedora/fusion-engine's
// real computeHighlightScore - proving compare-engines.ts can run against
// real v2 behavior today, not just mocks-of-mocks (see
// mock-predictor.spec.ts). Falls back to a simple average-of-values
// baseline (scaled to v2's 0-100 range) for clips with no matching fixture,
// e.g. when driven purely by loadMockDataset()'s synthetic data.
export class MockPredictor implements Predictor {
  constructor(private readonly fusionInputsByClipId: Map<string, FusionInput> = new Map()) {}

  async predict(vector: FeatureVector): Promise<PredictionResult> {
    const fusionInput = this.fusionInputsByClipId.get(vector.clipId);
    if (fusionInput) {
      const highlight = computeHighlightScore(fusionInput);
      return {
        clipId: vector.clipId,
        score: highlight.highlightScore ?? 0,
        confidence: highlight.confidence,
        modelVersion: FALLBACK_MODEL_VERSION,
      };
    }

    const average =
      vector.values.length === 0
        ? 0
        : vector.values.reduce((sum, v) => sum + v, 0) / vector.values.length;
    return {
      clipId: vector.clipId,
      score: average * 100,
      confidence: null,
      modelVersion: FALLBACK_MODEL_VERSION,
    };
  }
}
