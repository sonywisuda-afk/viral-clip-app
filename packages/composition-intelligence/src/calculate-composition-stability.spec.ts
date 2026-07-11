import { calculateCompositionStability } from './calculate-composition-stability';

function sample(t: number, xCenter: number | null, yCenter = 0.5) {
  return {
    t,
    subjectBox: xCenter === null ? null : { xCenter, yCenter, width: 0.2, height: 0.4 },
    subjectTrackId: null,
    facingYaw: null,
  };
}

describe('calculateCompositionStability', () => {
  it('returns null when fewer than two consecutive samples both have a subjectBox', () => {
    expect(calculateCompositionStability([sample(0, 0.5)])).toBeNull();
    expect(calculateCompositionStability([sample(0, 0.5), sample(1, null)])).toBeNull();
  });

  it('returns (near) zero for a held, unchanging frame', () => {
    const result = calculateCompositionStability([
      sample(0, 0.5, 0.5),
      sample(1, 0.5, 0.5),
      sample(2, 0.5, 0.5),
    ]);
    expect(result).toBeCloseTo(0);
  });

  it('scores an oscillating frame higher (less stable) than a held one', () => {
    const held = calculateCompositionStability([
      sample(0, 0.5, 0.5),
      sample(1, 0.5, 0.5),
      sample(2, 0.5, 0.5),
    ]);
    const oscillating = calculateCompositionStability([
      sample(0, 0.5, 0.5),
      sample(1, 0.05, 0.05),
      sample(2, 0.5, 0.5),
      sample(3, 0.05, 0.05),
    ]);
    expect(oscillating).toBeGreaterThan(held!);
  });

  it('only takes deltas between ADJACENT array entries, not across a gap', () => {
    const withGap = calculateCompositionStability([
      sample(0, 0.5, 0.5),
      sample(1, null),
      sample(2, 0.05, 0.05),
    ]);
    expect(withGap).toBeNull();
  });
});
