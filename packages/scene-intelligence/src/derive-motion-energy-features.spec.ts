import { deriveMotionEnergyFeatures } from './derive-motion-energy-features';

describe('deriveMotionEnergyFeatures', () => {
  it('returns all-null fields when there are no samples', () => {
    const result = deriveMotionEnergyFeatures([]);
    expect(result).toEqual({
      averageMotionEnergy: null,
      peakMotionEnergy: null,
      staticRatio: null,
      dynamicRatio: null,
    });
  });

  it('computes averageMotionEnergy as the mean of every sample', () => {
    const result = deriveMotionEnergyFeatures([
      { t: 0, motionEnergy: 2 },
      { t: 1, motionEnergy: 4 },
      { t: 2, motionEnergy: 6 },
    ]);
    expect(result.averageMotionEnergy).toBe(4);
  });

  it('computes peakMotionEnergy as the maximum sample', () => {
    const result = deriveMotionEnergyFeatures([
      { t: 0, motionEnergy: 2 },
      { t: 1, motionEnergy: 9.5 },
      { t: 2, motionEnergy: 6 },
    ]);
    expect(result.peakMotionEnergy).toBe(9.5);
  });

  it('classifies every sample as static when all are at/below the threshold', () => {
    const result = deriveMotionEnergyFeatures([
      { t: 0, motionEnergy: 0 },
      { t: 1, motionEnergy: 4 },
    ]);
    expect(result.staticRatio).toBe(1);
    expect(result.dynamicRatio).toBe(0);
  });

  it('classifies every sample as dynamic when all are above the threshold', () => {
    const result = deriveMotionEnergyFeatures([
      { t: 0, motionEnergy: 10 },
      { t: 1, motionEnergy: 20 },
    ]);
    expect(result.staticRatio).toBe(0);
    expect(result.dynamicRatio).toBe(1);
  });

  it('splits staticRatio/dynamicRatio proportionally for a mixed clip', () => {
    const result = deriveMotionEnergyFeatures([
      { t: 0, motionEnergy: 1 },
      { t: 1, motionEnergy: 2 },
      { t: 2, motionEnergy: 10 },
      { t: 3, motionEnergy: 20 },
    ]);
    expect(result.staticRatio).toBe(0.5);
    expect(result.dynamicRatio).toBe(0.5);
  });

  it('always sums staticRatio + dynamicRatio to 1', () => {
    const result = deriveMotionEnergyFeatures([
      { t: 0, motionEnergy: 1 },
      { t: 1, motionEnergy: 3.9 },
      { t: 2, motionEnergy: 4 },
      { t: 3, motionEnergy: 100 },
    ]);
    expect((result.staticRatio ?? 0) + (result.dynamicRatio ?? 0)).toBe(1);
  });
});
