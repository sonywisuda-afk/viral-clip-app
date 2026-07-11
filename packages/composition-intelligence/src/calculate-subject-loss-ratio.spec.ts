import { calculateSubjectLossRatio } from './calculate-subject-loss-ratio';

function sample(t: number, present: boolean) {
  return {
    t,
    subjectBox: present ? { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.4 } : null,
    subjectTrackId: null,
    facingYaw: null,
  };
}

describe('calculateSubjectLossRatio', () => {
  it('returns null when there are zero samples', () => {
    expect(calculateSubjectLossRatio([])).toBeNull();
  });

  it('returns 0 when the subject was visible every sample', () => {
    expect(calculateSubjectLossRatio([sample(0, true), sample(1, true)])).toBe(0);
  });

  it('returns 1 when the subject was never visible', () => {
    expect(calculateSubjectLossRatio([sample(0, false), sample(1, false)])).toBe(1);
  });

  it('returns the fraction of samples with no subject', () => {
    expect(
      calculateSubjectLossRatio([
        sample(0, true),
        sample(1, false),
        sample(2, false),
        sample(3, true),
      ]),
    ).toBe(0.5);
  });
});
