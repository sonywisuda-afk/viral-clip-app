import { speakerQualityScoreSchema, speakerVisibilitySampleSchema } from './speaker-quality';

describe('speakerVisibilitySampleSchema', () => {
  it('accepts a classified visibility state', () => {
    const result = speakerVisibilitySampleSchema.safeParse({ t: 1, state: 'full_face' });
    expect(result.success).toBe(true);
  });

  it('accepts null state (no face detected at all)', () => {
    const result = speakerVisibilitySampleSchema.safeParse({ t: 1, state: null });
    expect(result.success).toBe(true);
  });
});

describe('speakerQualityScoreSchema', () => {
  it('accepts a fully-populated composite score', () => {
    const result = speakerQualityScoreSchema.safeParse({
      faceTrackId: 4,
      visibilityScore: 0.9,
      sizeScore: 0.6,
      sharpnessScore: 0.8,
      lightingScore: 0.7,
      eyeContactRate: 0.5,
      overallScore: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all-null fields (no face tracked at all)', () => {
    const result = speakerQualityScoreSchema.safeParse({
      faceTrackId: null,
      visibilityScore: null,
      sizeScore: null,
      sharpnessScore: null,
      lightingScore: null,
      eyeContactRate: null,
      overallScore: null,
    });
    expect(result.success).toBe(true);
  });
});
