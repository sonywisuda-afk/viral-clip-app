import { calculateRuleOfThirdsScore } from './calculate-rule-of-thirds';

function sample(t: number, xCenter: number | null, yCenter = 0.5) {
  return {
    t,
    subjectBox: xCenter === null ? null : { xCenter, yCenter, width: 0.2, height: 0.4 },
    subjectTrackId: null,
    facingYaw: null,
  };
}

describe('calculateRuleOfThirdsScore', () => {
  it('returns null when there are zero samples', () => {
    expect(calculateRuleOfThirdsScore([])).toBeNull();
  });

  it('returns null when no sample ever had a subjectBox', () => {
    expect(calculateRuleOfThirdsScore([sample(0, null), sample(1, null)])).toBeNull();
  });

  it('returns 1 for a subject exactly on a thirds intersection', () => {
    expect(calculateRuleOfThirdsScore([sample(0, 1 / 3, 1 / 3)])).toBeCloseTo(1);
  });

  it('scores dead-center lower than a thirds-aligned subject', () => {
    const centered = calculateRuleOfThirdsScore([sample(0, 0.5, 0.5)]);
    const thirdsAligned = calculateRuleOfThirdsScore([sample(0, 1 / 3, 1 / 3)]);
    expect(thirdsAligned).toBeGreaterThan(centered!);
  });

  it('excludes frames with no subject rather than scoring them 0', () => {
    const withGap = calculateRuleOfThirdsScore([sample(0, 1 / 3, 1 / 3), sample(1, null)]);
    const withoutGap = calculateRuleOfThirdsScore([sample(0, 1 / 3, 1 / 3)]);
    expect(withGap).toBeCloseTo(withoutGap!);
  });
});
