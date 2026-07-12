import type { TrainingSample } from '@speedora/contracts';
import { MockModelEvaluator } from '../mock/mock-model-evaluator';
import { MockPredictor } from '../mock/mock-predictor';
import { runEvaluation } from './evaluation-runner';

function sample(clipId: string, label: number): TrainingSample {
  return {
    sampleId: `s-${clipId}`,
    featureVector: { clipId, featureNames: ['audio', 'scene'], values: [0.5, 0.5], extractedAt: '2026-01-01T00:00:00.000Z' },
    label,
  };
}

describe('runEvaluation', () => {
  it('runs the predictor over every sample and evaluates against the real labels', async () => {
    const predictor = new MockPredictor(); // no FusionInput fixtures -> average-of-values baseline (50)
    const evaluator = new MockModelEvaluator();
    const samples = [sample('a', 50), sample('b', 50)];

    const report = await runEvaluation(predictor, evaluator, samples);

    expect(report.sampleCount).toBe(2);
    expect(report.modelVersion).toBe('mock-v3-baseline');
    // MockPredictor always predicts 50 here (average of [0.5,0.5]*100), matching
    // both samples' labels exactly -> zero error.
    expect(report.metrics.mse).toBe(0);
    expect(report.metrics.mae).toBe(0);
    expect(report.metrics.sampleCount).toBe(2);
  });

  it('returns "unknown" modelVersion for an empty sample set', async () => {
    const report = await runEvaluation(new MockPredictor(), new MockModelEvaluator(), []);
    expect(report.modelVersion).toBe('unknown');
    expect(report.sampleCount).toBe(0);
  });
});
