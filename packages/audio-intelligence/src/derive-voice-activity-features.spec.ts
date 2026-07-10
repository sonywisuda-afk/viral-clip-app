import { deriveVoiceActivityFeatures } from './derive-voice-activity-features';

describe('deriveVoiceActivityFeatures', () => {
  it('returns all-null when there are zero segments', () => {
    expect(deriveVoiceActivityFeatures([], 60)).toEqual({
      speechRatio: null,
      silenceRatio: null,
      silenceSegmentCount: null,
      longestSilenceSeconds: null,
    });
  });

  it('returns all-null when durationSeconds is 0', () => {
    expect(
      deriveVoiceActivityFeatures([{ start: 0, end: 0, category: 'speech', confidence: null }], 0),
    ).toEqual({
      speechRatio: null,
      silenceRatio: null,
      silenceSegmentCount: null,
      longestSilenceSeconds: null,
    });
  });

  it('computes speech/silence ratios and the longest+count of silence segments', () => {
    const result = deriveVoiceActivityFeatures(
      [
        { start: 0, end: 2, category: 'silence', confidence: null },
        { start: 2, end: 8, category: 'speech', confidence: null },
        { start: 8, end: 9, category: 'non_speech', confidence: null },
        { start: 9, end: 10, category: 'silence', confidence: null },
      ],
      10,
    );

    expect(result).toEqual({
      speechRatio: 0.6,
      silenceRatio: 0.3,
      silenceSegmentCount: 2,
      longestSilenceSeconds: 2,
    });
  });

  it('does not count non_speech toward silenceRatio/silenceSegmentCount', () => {
    const result = deriveVoiceActivityFeatures(
      [{ start: 0, end: 10, category: 'non_speech', confidence: null }],
      10,
    );

    expect(result.silenceRatio).toBe(0);
    expect(result.silenceSegmentCount).toBe(0);
    expect(result.speechRatio).toBe(0);
  });
});
