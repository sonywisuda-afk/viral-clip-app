import { detectFacesOutputSchema, faceSampleSchema } from './reframe';

describe('faceSampleSchema', () => {
  it('accepts a sample with a detected face', () => {
    const result = faceSampleSchema.safeParse({
      t: 1.5,
      box: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.3 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a sample with no detected face (null box)', () => {
    expect(faceSampleSchema.safeParse({ t: 1.5, box: null }).success).toBe(true);
  });

  it('rejects a sample missing a required box field', () => {
    const result = faceSampleSchema.safeParse({ t: 1.5, box: { xCenter: 0.5 } });
    expect(result.success).toBe(false);
  });
});

describe('detectFacesOutputSchema', () => {
  it('accepts an empty array', () => {
    expect(detectFacesOutputSchema.safeParse([]).success).toBe(true);
  });

  it('accepts a mix of detected and non-detected samples', () => {
    const result = detectFacesOutputSchema.safeParse([
      { t: 0, box: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.3 } },
      { t: 1, box: null },
    ]);
    expect(result.success).toBe(true);
  });
});
