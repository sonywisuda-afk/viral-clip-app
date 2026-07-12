import type { PredictionResult, TrainingSample } from '@speedora/contracts';
import { MockModelEvaluator } from './mock-model-evaluator';

function sample(clipId: string, label: number): TrainingSample {
  return {
    sampleId: `s-${clipId}`,
    featureVector: { clipId, featureNames: [], values: [], extractedAt: '2026-01-01T00:00:00.000Z' },
    label,
  };
}

function prediction(clipId: string, score: number): PredictionResult {
  return { clipId, score, confidence: null, modelVersion: 'test' };
}

describe('MockModelEvaluator', () => {
  it('returns zero error for perfect predictions', async () => {
    const evaluator = new MockModelEvaluator();
    const result = await evaluator.evaluate([prediction('a', 5), prediction('b', 10)], [
      sample('a', 5),
      sample('b', 10),
    ]);
    expect(result.mse).toBe(0);
    expect(result.mae).toBe(0);
    expect(result.sampleCount).toBe(2);
  });

  it('computes mse/mae for imperfect predictions', async () => {
    const evaluator = new MockModelEvaluator();
    // errors: 2 and -2 -> mae = 2, mse = 4
    const result = await evaluator.evaluate([prediction('a', 7), prediction('b', 8)], [
      sample('a', 5),
      sample('b', 10),
    ]);
    expect(result.mae).toBe(2);
    expect(result.mse).toBe(4);
  });

  it('drops predictions with no matching ground-truth clipId', async () => {
    const evaluator = new MockModelEvaluator();
    const result = await evaluator.evaluate([prediction('a', 5), prediction('unmatched', 100)], [
      sample('a', 5),
    ]);
    expect(result.sampleCount).toBe(1);
    expect(result.mse).toBe(0);
  });

  it('returns all-zero with sampleCount 0 when nothing matches', async () => {
    const evaluator = new MockModelEvaluator();
    const result = await evaluator.evaluate([prediction('x', 1)], [sample('y', 2)]);
    expect(result).toEqual({ mse: 0, mae: 0, sampleCount: 0 });
  });
});
