import { speakingStyleFeaturesSchema } from './speaking-style';

describe('speakingStyleFeaturesSchema', () => {
  it('accepts a fully-populated features object', () => {
    const result = speakingStyleFeaturesSchema.safeParse({
      averageSpeakingRateWordsPerSecond: 2.4,
      paceLabel: 'normal',
      pauseRate: 0.15,
      longPauseCount: 2,
      averageVoiceEnergyDb: -12.5,
      pitchVariation: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all-null fields (no data to derive from)', () => {
    const result = speakingStyleFeaturesSchema.safeParse({
      averageSpeakingRateWordsPerSecond: null,
      paceLabel: null,
      pauseRate: null,
      longPauseCount: null,
      averageVoiceEnergyDb: null,
      pitchVariation: null,
    });
    expect(result.success).toBe(true);
  });
});
