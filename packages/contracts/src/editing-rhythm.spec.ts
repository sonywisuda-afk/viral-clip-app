import { editingRhythmFeaturesSchema, editingRhythmInputSchema } from './editing-rhythm';

describe('editingRhythmInputSchema', () => {
  it('accepts a fully-populated input', () => {
    const result = editingRhythmInputSchema.safeParse({
      clipDurationSeconds: 30,
      sceneCuts: [5, 12, 20],
      motionEnergySamples: [
        { t: 0, motionEnergy: 2 },
        { t: 1, motionEnergy: 8 },
      ],
      cutsPerMinute: 6,
      averageMotionEnergy: 5,
      averageSpeakingRateWordsPerSecond: 2.5,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null aggregate features and empty raw arrays', () => {
    const result = editingRhythmInputSchema.safeParse({
      clipDurationSeconds: 0,
      sceneCuts: [],
      motionEnergySamples: [],
      cutsPerMinute: null,
      averageMotionEnergy: null,
      averageSpeakingRateWordsPerSecond: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('editingRhythmFeaturesSchema', () => {
  it('accepts a fully-populated features object', () => {
    const result = editingRhythmFeaturesSchema.safeParse({
      tempoScore: 0.6,
      pacingScore: 0.8,
      accelerationScore: 0.3,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all-null fields (no data to derive from)', () => {
    const result = editingRhythmFeaturesSchema.safeParse({
      tempoScore: null,
      pacingScore: null,
      accelerationScore: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an accelerationScore outside [-1, 1]', () => {
    const result = editingRhythmFeaturesSchema.safeParse({
      tempoScore: 0.5,
      pacingScore: 0.5,
      accelerationScore: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
