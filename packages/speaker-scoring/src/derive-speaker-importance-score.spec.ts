import { deriveSpeakerImportanceScore } from './derive-speaker-importance-score';

describe('deriveSpeakerImportanceScore', () => {
  it('returns all-null (including score) when both ratios are null', () => {
    expect(deriveSpeakerImportanceScore('Speaker A', null, null, null)).toEqual({
      speakerId: 'Speaker A',
      role: null,
      talkTimeRatio: null,
      screenTimeRatio: null,
      score: null,
    });
  });

  it('passes role through unchanged without factoring it into score', () => {
    const withHost = deriveSpeakerImportanceScore('Speaker A', 'host', 0.5, 0.5);
    const withoutRole = deriveSpeakerImportanceScore('Speaker A', null, 0.5, 0.5);
    expect(withHost.role).toBe('host');
    expect(withHost.score).toBe(withoutRole.score);
  });

  it('scores 100 when both talkTimeRatio and screenTimeRatio are 1', () => {
    expect(deriveSpeakerImportanceScore('Speaker A', null, 1, 1).score).toBe(100);
  });

  it('averages only the available ratio when the other is null', () => {
    expect(deriveSpeakerImportanceScore('Speaker A', null, 0.4, null).score).toBe(40);
  });
});
