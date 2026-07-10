import {
  detectVoiceActivityInputSchema,
  voiceActivityFeaturesSchema,
  voiceActivitySegmentSchema,
} from './voice-activity';

describe('detectVoiceActivityInputSchema', () => {
  it('requires durationSeconds', () => {
    const result = detectVoiceActivityInputSchema.safeParse({ audioPath: '/tmp/audio.wav' });
    expect(result.success).toBe(false);
  });

  it('accepts audioPath + durationSeconds', () => {
    const result = detectVoiceActivityInputSchema.safeParse({
      audioPath: '/tmp/audio.wav',
      durationSeconds: 120,
    });
    expect(result.success).toBe(true);
  });
});

describe('voiceActivitySegmentSchema', () => {
  it('accepts a classified speech segment', () => {
    const result = voiceActivitySegmentSchema.safeParse({
      start: 1.2,
      end: 4.5,
      category: 'speech',
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null confidence', () => {
    const result = voiceActivitySegmentSchema.safeParse({
      start: 0,
      end: 1,
      category: 'silence',
      confidence: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unrecognized category', () => {
    const result = voiceActivitySegmentSchema.safeParse({
      start: 0,
      end: 1,
      category: 'applause',
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('voiceActivityFeaturesSchema', () => {
  it('accepts all-null fields (no data to derive from)', () => {
    const result = voiceActivityFeaturesSchema.safeParse({
      speechRatio: null,
      silenceRatio: null,
      silenceSegmentCount: null,
      longestSilenceSeconds: null,
    });
    expect(result.success).toBe(true);
  });
});
