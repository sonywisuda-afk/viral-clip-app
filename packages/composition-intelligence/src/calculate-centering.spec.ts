import { calculateCenteringScore } from './calculate-centering';

function sample(t: number, xCenter: number | null, yCenter = 0.5) {
  return {
    t,
    subjectBox: xCenter === null ? null : { xCenter, yCenter, width: 0.2, height: 0.4 },
    subjectTrackId: null,
    facingYaw: null,
  };
}

describe('calculateCenteringScore', () => {
  it('returns null when there are zero samples', () => {
    expect(calculateCenteringScore([])).toBeNull();
  });

  it('returns null when no sample ever had a subjectBox', () => {
    expect(calculateCenteringScore([sample(0, null)])).toBeNull();
  });

  it('returns 1 for a dead-center subject', () => {
    expect(calculateCenteringScore([sample(0, 0.5, 0.5)])).toBeCloseTo(1);
  });

  it('returns 0 for a subject in a corner', () => {
    expect(calculateCenteringScore([sample(0, 0, 0)])).toBeCloseTo(0);
  });

  it('excludes frames with no subject rather than scoring them 0', () => {
    const withGap = calculateCenteringScore([sample(0, 0.5, 0.5), sample(1, null)]);
    expect(withGap).toBeCloseTo(1);
  });
});
