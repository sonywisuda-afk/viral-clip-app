import type { OcrTextTrack } from '@speedora/contracts';
import { deriveOcrFeatures } from './derive-ocr-features';

function track(overrides: Partial<OcrTextTrack> = {}): OcrTextTrack {
  return {
    trackId: 0,
    text: 'some text',
    boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.05 },
    confidence: 0.9,
    startTime: 0,
    endTime: 1,
    durationSeconds: 1,
    appearsFrames: 1,
    persistenceScore: 0.1,
    motionScore: 0,
    nearFace: null,
    language: null,
    regexFlags: { isPriceLike: false, isNameLike: false },
    category: 'caption',
    categoryConfidence: 0.3,
    classificationMethod: 'HybridRuleEngine',
    ...overrides,
  };
}

describe('deriveOcrFeatures', () => {
  it('returns all-null features when zero samples were ever taken', () => {
    expect(deriveOcrFeatures([], 0)).toEqual({
      subtitleCoverageRate: null,
      slidePresenceRate: null,
      captionRate: null,
      logoPresenceRate: null,
      priceMentionRate: null,
      nameMentionRate: null,
      dominantTextCategory: null,
      averageTextBlockCount: null,
    });
  });

  it('returns real zero rates (not null) when samples were taken but no text of a category ever appeared', () => {
    const result = deriveOcrFeatures([], 10);
    expect(result.subtitleCoverageRate).toBe(0);
    expect(result.priceMentionRate).toBe(0);
    expect(result.dominantTextCategory).toBeNull();
    expect(result.averageTextBlockCount).toBe(0);
  });

  it('computes a coverage rate as appearsFrames summed across all tracks of that category, divided by total samples', () => {
    const result = deriveOcrFeatures(
      [
        track({ category: 'subtitle', appearsFrames: 3 }),
        track({ category: 'subtitle', appearsFrames: 2 }),
        track({ category: 'price', appearsFrames: 1 }),
      ],
      10,
    );
    expect(result.subtitleCoverageRate).toBeCloseTo(0.5);
    expect(result.priceMentionRate).toBeCloseTo(0.1);
    expect(result.logoPresenceRate).toBe(0);
  });

  it('computes dominantTextCategory weighted by appearsFrames, not raw track count', () => {
    const result = deriveOcrFeatures(
      [
        track({ category: 'price', appearsFrames: 1 }),
        track({ category: 'price', appearsFrames: 1 }),
        track({ category: 'price', appearsFrames: 1 }),
        track({ category: 'logo', appearsFrames: 10 }),
      ],
      20,
    );
    expect(result.dominantTextCategory).toBe('logo');
  });

  it('breaks a dominantTextCategory tie by first occurrence in the tracks array', () => {
    const result = deriveOcrFeatures(
      [
        track({ category: 'subtitle', appearsFrames: 5 }),
        track({ category: 'caption', appearsFrames: 5 }),
      ],
      10,
    );
    expect(result.dominantTextCategory).toBe('subtitle');
  });

  it('computes averageTextBlockCount as total appearances across all tracks divided by total samples', () => {
    const result = deriveOcrFeatures(
      [track({ appearsFrames: 4 }), track({ appearsFrames: 6 })],
      10,
    );
    expect(result.averageTextBlockCount).toBeCloseTo(1);
  });
});
