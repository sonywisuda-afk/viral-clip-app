import { formatPct, signalLabel, toBarPercent } from './ops-ai';

describe('signalLabel', () => {
  it('renames facial to Emotion, matching FUSION_V2_TO_V3_SIGNAL_MAP', () => {
    expect(signalLabel('facial')).toBe('Emotion');
  });

  it('returns a human label for a known v2 signal', () => {
    expect(signalLabel('audio')).toBe('Audio');
    expect(signalLabel('sceneMotion')).toBe('Scene Motion');
  });

  it('falls back to the raw key for an unknown signal', () => {
    expect(signalLabel('somethingNew')).toBe('somethingNew');
  });
});

describe('formatPct', () => {
  it('rounds to the nearest whole percent', () => {
    expect(formatPct(33.4)).toBe('33%');
    expect(formatPct(33.6)).toBe('34%');
  });
});

describe('toBarPercent', () => {
  it('scales count relative to max', () => {
    expect(toBarPercent(5, 10)).toBe(50);
  });

  it('returns 0 when max is 0', () => {
    expect(toBarPercent(5, 0)).toBe(0);
  });
});
