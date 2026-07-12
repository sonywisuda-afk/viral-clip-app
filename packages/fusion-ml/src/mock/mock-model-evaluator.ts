import type { PredictionResult, TrainingSample } from '@speedora/contracts';
import type { ModelEvaluator } from '../interfaces';

// The one ModelEvaluator implementation this milestone ships - real mean
// squared/absolute error between predicted scores and ground-truth labels,
// matched by clipId. Predictions with no matching ground-truth sample are
// dropped, not treated as zero-error. `sampleCount` is included so a
// caller can tell "0 error because it's a great model" apart from "0 error
// because nothing matched."
export class MockModelEvaluator implements ModelEvaluator {
  async evaluate(
    predictions: PredictionResult[],
    groundTruth: TrainingSample[],
  ): Promise<Record<string, number>> {
    const labelByClipId = new Map(groundTruth.map((s) => [s.featureVector.clipId, s.label]));
    const pairs = predictions
      .filter((p) => labelByClipId.has(p.clipId))
      .map((p) => ({ predicted: p.score, actual: labelByClipId.get(p.clipId)! }));

    if (pairs.length === 0) return { mse: 0, mae: 0, sampleCount: 0 };

    const mse = pairs.reduce((sum, p) => sum + (p.predicted - p.actual) ** 2, 0) / pairs.length;
    const mae = pairs.reduce((sum, p) => sum + Math.abs(p.predicted - p.actual), 0) / pairs.length;
    return { mse, mae, sampleCount: pairs.length };
  }
}
