import { calculateTempo } from './calculate-tempo';

describe('calculateTempo', () => {
  it('returns null when none of the three inputs are available', () => {
    const result = calculateTempo({
      cutsPerMinute: null,
      averageMotionEnergy: null,
      averageSpeakingRateWordsPerSecond: null,
    });
    expect(result).toBeNull();
  });

  it('normalizes a single available input on its own', () => {
    const result = calculateTempo({
      cutsPerMinute: 10,
      averageMotionEnergy: null,
      averageSpeakingRateWordsPerSecond: null,
    });
    expect(result).toBeCloseTo(0.5);
  });

  it('averages all three available inputs', () => {
    const result = calculateTempo({
      cutsPerMinute: 20,
      averageMotionEnergy: 20,
      averageSpeakingRateWordsPerSecond: 3.5,
    });
    expect(result).toBeCloseTo(1);
  });

  it('clamps a value above the cap to 1', () => {
    const result = calculateTempo({
      cutsPerMinute: 100,
      averageMotionEnergy: null,
      averageSpeakingRateWordsPerSecond: null,
    });
    expect(result).toBe(1);
  });

  it('averages just the available subset when some inputs are null', () => {
    const result = calculateTempo({
      cutsPerMinute: 20,
      averageMotionEnergy: null,
      averageSpeakingRateWordsPerSecond: 3.5,
    });
    expect(result).toBeCloseTo(1);
  });
});
