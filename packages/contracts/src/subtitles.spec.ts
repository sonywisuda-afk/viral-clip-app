import { buildAssInputSchema, captionStyleSchema } from './subtitles';

describe('captionStyleSchema', () => {
  it('accepts each known caption style', () => {
    expect(captionStyleSchema.safeParse('DEFAULT').success).toBe(true);
    expect(captionStyleSchema.safeParse('KARAOKE').success).toBe(true);
    expect(captionStyleSchema.safeParse('BOLD_HIGHLIGHT').success).toBe(true);
  });

  it('rejects an unknown style', () => {
    expect(captionStyleSchema.safeParse('COMIC_SANS').success).toBe(false);
  });
});

describe('buildAssInputSchema', () => {
  const base = {
    segments: [{ start: 0, end: 5, text: 'hi' }],
    clipStart: 0,
    clipEnd: 5,
    style: 'DEFAULT',
    videoWidth: 1080,
    videoHeight: 1920,
  };

  it('accepts a fully-formed input', () => {
    expect(buildAssInputSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a segment with word-level timestamps', () => {
    const result = buildAssInputSchema.safeParse({
      ...base,
      segments: [{ start: 0, end: 5, text: 'hi', words: [{ word: 'hi', start: 0, end: 0.5 }] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid style', () => {
    expect(buildAssInputSchema.safeParse({ ...base, style: 'COMIC_SANS' }).success).toBe(false);
  });
});
