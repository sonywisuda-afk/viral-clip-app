import { validateFeatureVector } from './feature-schema-validation';

describe('validateFeatureVector', () => {
  it('accepts a well-formed FeatureVector', () => {
    const input = {
      clipId: 'c1',
      featureNames: ['audio', 'scene'],
      values: [0.5, 0.8],
      extractedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(validateFeatureVector(input)).toEqual(input);
  });

  it('throws when featureNames and values have different lengths', () => {
    expect(() =>
      validateFeatureVector({
        clipId: 'c1',
        featureNames: ['audio'],
        values: [0.5, 0.8],
        extractedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('throws on a missing required field', () => {
    expect(() =>
      validateFeatureVector({
        clipId: 'c1',
        values: [0.5],
        extractedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('throws on completely wrong input shape', () => {
    expect(() => validateFeatureVector('not an object')).toThrow();
    expect(() => validateFeatureVector(null)).toThrow();
  });
});
