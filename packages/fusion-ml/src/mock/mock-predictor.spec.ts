import type { FusionInput } from '@speedora/contracts';
import { computeHighlightScore } from '@speedora/fusion-engine';
import { MockPredictor } from './mock-predictor';

function fixtureVector(clipId: string) {
  return {
    clipId,
    featureNames: ['audio', 'scene'],
    values: [0.5, 0.5],
    extractedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('MockPredictor', () => {
  it('calls real computeHighlightScore from @speedora/fusion-engine when a FusionInput fixture is injected', async () => {
    const fusionInput: FusionInput = {
      clipId: 'clip-1',
      audio: {
        averageRmsDb: -20,
        peakDb: -10,
        averageSpeakingRateWordsPerSecond: 3,
        speakingRateStdDev: 0.5,
      },
    };
    // Real v2 output, computed directly - this is the "ground truth" the
    // predictor below must exactly match, proving it's a genuine pass-
    // through, not a coincidence.
    const expected = computeHighlightScore(fusionInput);

    const predictor = new MockPredictor(new Map([['clip-1', fusionInput]]));
    const result = await predictor.predict(fixtureVector('clip-1'));

    expect(result.clipId).toBe('clip-1');
    expect(result.score).toBe(expected.highlightScore);
    expect(result.confidence).toBe(expected.confidence);
  });

  it('falls back to an average-of-values baseline when no fixture is injected for the clip', async () => {
    const predictor = new MockPredictor();
    const result = await predictor.predict(fixtureVector('unknown-clip'));

    expect(result.score).toBe(50); // average of [0.5, 0.5] * 100
    expect(result.confidence).toBeNull();
  });

  it('handles an empty values array without dividing by zero', async () => {
    const predictor = new MockPredictor();
    const result = await predictor.predict({
      clipId: 'empty',
      featureNames: [],
      values: [],
      extractedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.score).toBe(0);
  });
});
