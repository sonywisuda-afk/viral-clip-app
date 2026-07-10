import { deriveEditingRhythmFeatures } from './derive-editing-rhythm-features';

describe('deriveEditingRhythmFeatures', () => {
  it('returns all-null fields when there is no data at all', () => {
    const result = deriveEditingRhythmFeatures({
      clipDurationSeconds: 0,
      sceneCuts: [],
      motionEnergySamples: [],
      cutsPerMinute: null,
      averageMotionEnergy: null,
      averageSpeakingRateWordsPerSecond: null,
    });
    expect(result).toEqual({
      tempoScore: null,
      pacingScore: null,
      accelerationScore: null,
    });
  });

  it('combines calculateTempo/calculatePacing/calculateAcceleration into one features object', () => {
    const result = deriveEditingRhythmFeatures({
      clipDurationSeconds: 30,
      sceneCuts: [10, 20],
      motionEnergySamples: [
        { t: 5, motionEnergy: 2 },
        { t: 25, motionEnergy: 18 },
      ],
      cutsPerMinute: 4,
      averageMotionEnergy: 10,
      averageSpeakingRateWordsPerSecond: 1.75,
    });

    expect(result.tempoScore).toBeCloseTo((4 / 20 + 10 / 20 + 1.75 / 3.5) / 3);
    expect(result.pacingScore).toBe(1);
    expect(result.accelerationScore).toBeGreaterThan(0);
  });
});
