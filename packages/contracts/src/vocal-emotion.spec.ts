import { detectVocalEmotionsOutputSchema, vocalEmotionResultSchema } from './vocal-emotion';

describe('vocalEmotionResultSchema', () => {
  it('accepts a classified result', () => {
    const result = vocalEmotionResultSchema.safeParse({ emotion: 'hap', score: 0.83 });
    expect(result.success).toBe(true);
  });

  it('accepts null (segment too short to classify)', () => {
    const result = vocalEmotionResultSchema.safeParse(null);
    expect(result.success).toBe(true);
  });

  it("rejects an emotion label outside the model taxonomy (e.g. a full word instead of the model's own short code)", () => {
    const result = vocalEmotionResultSchema.safeParse({ emotion: 'happy', score: 0.5 });
    expect(result.success).toBe(false);
  });
});

describe('detectVocalEmotionsOutputSchema', () => {
  it('accepts a mix of classified and skipped (null) segments', () => {
    const result = detectVocalEmotionsOutputSchema.safeParse([
      { emotion: 'neu', score: 0.6 },
      null,
    ]);
    expect(result.success).toBe(true);
  });
});
