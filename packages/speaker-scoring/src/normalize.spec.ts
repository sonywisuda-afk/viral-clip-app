import {
  averageAvailable,
  clamp,
  headPoseStabilityScore,
  speakingActivityScore,
  voiceEnergyScore,
  voiceStabilityScore,
} from './normalize';

describe('clamp', () => {
  it('clamps a value within [min, max]', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('voiceEnergyScore', () => {
  it('maps -40dB to 0 and -10dB to 1 (the same cap fusion-engine uses)', () => {
    expect(voiceEnergyScore(-40)).toBe(0);
    expect(voiceEnergyScore(-10)).toBe(1);
    expect(voiceEnergyScore(-25)).toBeCloseTo(0.5);
  });

  it('clamps values outside the cap range', () => {
    expect(voiceEnergyScore(-60)).toBe(0);
    expect(voiceEnergyScore(0)).toBe(1);
  });
});

describe('voiceStabilityScore', () => {
  it('reads a zero stddev as maximally stable', () => {
    expect(voiceStabilityScore(0)).toBe(1);
  });

  it('reads stddev at/above the cap as maximally unstable', () => {
    expect(voiceStabilityScore(2)).toBe(0);
    expect(voiceStabilityScore(10)).toBe(0);
  });
});

describe('speakingActivityScore', () => {
  it('reads 0 wps as no activity and the cap as maximal', () => {
    expect(speakingActivityScore(0)).toBe(0);
    expect(speakingActivityScore(4)).toBe(1);
  });

  it('clamps above the cap rather than exceeding 1', () => {
    expect(speakingActivityScore(10)).toBe(1);
  });
});

describe('headPoseStabilityScore', () => {
  it('reads zero movement as maximally stable, cap-or-above as maximally unstable', () => {
    expect(headPoseStabilityScore(0)).toBe(1);
    expect(headPoseStabilityScore(30)).toBe(0);
  });
});

describe('averageAvailable', () => {
  it('averages only the non-null components', () => {
    expect(averageAvailable([0.5, null, 1])).toBe(0.75);
  });

  it('returns null when every component is null', () => {
    expect(averageAvailable([null, null])).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(averageAvailable([])).toBeNull();
  });
});
