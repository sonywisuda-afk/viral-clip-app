import { calculateFramingConsistency } from './calculate-framing-consistency';

function sample(t: number, area: number | null) {
  if (area === null) {
    return { t, subjectBox: null, subjectTrackId: null, facingYaw: null };
  }
  const side = Math.sqrt(area);
  return {
    t,
    subjectBox: { xCenter: 0.5, yCenter: 0.5, width: side, height: side },
    subjectTrackId: null,
    facingYaw: null,
  };
}

const CLOSE_UP_AREA = 0.36; // >= 0.25 threshold
const WIDE_AREA = 0.04; // < 0.08 threshold

describe('calculateFramingConsistency', () => {
  it('returns null when fewer than two samples have a subjectBox', () => {
    expect(calculateFramingConsistency([sample(0, CLOSE_UP_AREA)])).toBeNull();
  });

  it('returns null when the derived clip duration is zero', () => {
    expect(
      calculateFramingConsistency([sample(0, CLOSE_UP_AREA), sample(0, WIDE_AREA)]),
    ).toBeNull();
  });

  it('returns 0 when the shot type never changes', () => {
    expect(calculateFramingConsistency([sample(0, CLOSE_UP_AREA), sample(60, CLOSE_UP_AREA)])).toBe(
      0,
    );
  });

  it('counts one transition per minute for one shot-type change over a one-minute span', () => {
    expect(
      calculateFramingConsistency([sample(0, CLOSE_UP_AREA), sample(60, WIDE_AREA)]),
    ).toBeCloseTo(1);
  });

  it('counts every shot-type flip, not just distinct shot types used', () => {
    // close_up -> wide -> close_up -> wide over 60s = 3 transitions/minute.
    const result = calculateFramingConsistency([
      sample(0, CLOSE_UP_AREA),
      sample(20, WIDE_AREA),
      sample(40, CLOSE_UP_AREA),
      sample(60, WIDE_AREA),
    ]);
    expect(result).toBeCloseTo(3);
  });
});
