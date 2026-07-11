import { calculateHeadroomScore } from './calculate-headroom';

function sample(t: number, yCenter: number | null, height = 0.4) {
  return {
    t,
    subjectBox: yCenter === null ? null : { xCenter: 0.5, yCenter, width: 0.2, height },
    subjectTrackId: null,
    facingYaw: null,
  };
}

describe('calculateHeadroomScore', () => {
  it('returns null when no sample ever had a subjectBox', () => {
    expect(calculateHeadroomScore([sample(0, null)])).toBeNull();
  });

  it('scores 1 when headroom falls inside the landscape target range', () => {
    // topEdge = yCenter - height/2 = 0.3 - 0.2 = 0.1, inside [0.05, 0.15].
    expect(calculateHeadroomScore([sample(0, 0.3)])).toBe(1);
  });

  it('scores lower the further headroom is outside the target range', () => {
    const inRange = calculateHeadroomScore([sample(0, 0.3)]); // topEdge 0.1
    const tooTight = calculateHeadroomScore([sample(0, 0.2)]); // topEdge 0
    const wayTooTight = calculateHeadroomScore([sample(0, 0.15, 0.5)]); // topEdge < 0, clamped to 0
    expect(tooTight).toBeLessThan(inRange!);
    expect(wayTooTight).toBeLessThanOrEqual(tooTight!);
  });

  it('uses a different (wider) target range for portrait frames', () => {
    // topEdge = 0.26 - 0.2 = 0.06: inside the landscape range [0.05, 0.15]
    // but below the portrait range [0.08, 0.2].
    const landscape = calculateHeadroomScore([sample(0, 0.26)], { width: 1920, height: 1080 });
    const portrait = calculateHeadroomScore([sample(0, 0.26)], { width: 1080, height: 1920 });
    expect(landscape).toBe(1);
    expect(portrait).toBeLessThan(1);
  });

  it('degrades to the landscape/neutral range when frameSize is null', () => {
    expect(calculateHeadroomScore([sample(0, 0.3)], null)).toBe(1);
  });
});
