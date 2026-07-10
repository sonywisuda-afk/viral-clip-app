import { calculateAcceleration } from './calculate-acceleration';

describe('calculateAcceleration', () => {
  it('returns null for a zero-duration clip', () => {
    expect(calculateAcceleration(0, [1], [])).toBeNull();
  });

  it('returns null when there are no cuts and no motion samples', () => {
    expect(calculateAcceleration(30, [], [])).toBeNull();
  });

  it('returns a positive score when cuts are concentrated in the second half', () => {
    const result = calculateAcceleration(30, [16, 18, 20, 22], []);
    expect(result).toBeGreaterThan(0);
  });

  it('returns a negative score when cuts are concentrated in the first half', () => {
    const result = calculateAcceleration(30, [2, 4, 6, 8], []);
    expect(result).toBeLessThan(0);
  });

  it('returns 0 when cuts are evenly split across the midpoint', () => {
    const result = calculateAcceleration(30, [5, 10, 20, 25], []);
    expect(result).toBe(0);
  });

  it('uses only the motion-energy balance when there are no cuts', () => {
    const result = calculateAcceleration(
      10,
      [],
      [
        { t: 1, motionEnergy: 2 },
        { t: 6, motionEnergy: 18 },
      ],
    );
    expect(result).toBeGreaterThan(0);
  });

  it('averages cut-based and motion-based balance when both are available', () => {
    // Cuts perfectly balanced (score 0); motion energy is 0 in the first
    // half and 20 in the second half (score 1, since balance needs at
    // least one sample on each side of the midpoint) - average should be
    // 0.5.
    const result = calculateAcceleration(
      10,
      [2, 8],
      [
        { t: 1, motionEnergy: 0 },
        { t: 8, motionEnergy: 20 },
      ],
    );
    expect(result).toBeCloseTo(0.5);
  });

  it('ignores motion-energy samples entirely on one side of the midpoint', () => {
    // Only second-half motion samples exist - can't compute a motion
    // balance without data on both sides, so acceleration falls back to
    // the cut-based balance alone.
    const result = calculateAcceleration(
      10,
      [8],
      [
        { t: 6, motionEnergy: 10 },
        { t: 7, motionEnergy: 10 },
      ],
    );
    expect(result).toBe(1);
  });
});
