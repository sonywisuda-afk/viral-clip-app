import type { TrainingSample } from '@speedora/contracts';
import type { ModelEvaluator, Predictor } from '../interfaces';

export interface EvaluationReport {
  modelVersion: string;
  sampleCount: number;
  metrics: Record<string, number>;
}

// Real orchestration wiring two already-real interfaces together - no new
// math (see evaluation/metrics.ts for that). Runs `predictor.predict()`
// over every sample's featureVector, then hands the whole batch to
// `evaluator.evaluate()` against the samples' own labels as ground truth.
// `modelVersion` is read off the first prediction (every prediction from
// one Predictor call should share the same modelVersion) - `Predictor`
// doesn't expose its version as a separate property, only per-prediction.
export async function runEvaluation(
  predictor: Predictor,
  evaluator: ModelEvaluator,
  samples: TrainingSample[],
): Promise<EvaluationReport> {
  const predictions = await Promise.all(samples.map((s) => predictor.predict(s.featureVector)));
  const metrics = await evaluator.evaluate(predictions, samples);
  return {
    modelVersion: predictions[0]?.modelVersion ?? 'unknown',
    sampleCount: samples.length,
    metrics,
  };
}
