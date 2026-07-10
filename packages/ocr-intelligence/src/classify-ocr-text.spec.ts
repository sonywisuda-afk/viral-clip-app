import type { OcrTrackedFeatures } from './track-ocr-text';
import { classifyOcrTrack } from './classify-ocr-text';

function trackedFeatures(overrides: Partial<OcrTrackedFeatures> = {}): OcrTrackedFeatures {
  return {
    trackId: 0,
    text: 'some text',
    boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.05 },
    confidence: 0.9,
    startTime: 0,
    endTime: 1,
    durationSeconds: 1,
    appearsFrames: 2,
    persistenceScore: 0.5,
    motionScore: 0,
    nearFace: null,
    language: null,
    regexFlags: { isPriceLike: false, isNameLike: false },
    ...overrides,
  };
}

describe('classifyOcrTrack', () => {
  it('classifies a wide, bottom-centered, static text block as a subtitle', () => {
    const result = classifyOcrTrack(
      trackedFeatures({
        text: 'a wide subtitle line',
        boundingBox: { xCenter: 0.5, yCenter: 0.9, width: 0.7, height: 0.05 },
        motionScore: 0,
      }),
    );
    expect(result.category).toBe('subtitle');
    expect(result.classificationMethod).toBe('HybridRuleEngine');
  });

  it('classifies a large, static block covering much of the frame as a slide', () => {
    const result = classifyOcrTrack(
      trackedFeatures({
        boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.7, height: 0.6 },
        motionScore: 0,
      }),
    );
    expect(result.category).toBe('slide');
  });

  it('classifies a small, corner-positioned, persistent block as a logo', () => {
    const result = classifyOcrTrack(
      trackedFeatures({
        boundingBox: { xCenter: 0.95, yCenter: 0.05, width: 0.05, height: 0.03 },
        persistenceScore: 1,
      }),
    );
    expect(result.category).toBe('logo');
  });

  it('classifies a currency-shaped text as a price mention, regardless of position', () => {
    const result = classifyOcrTrack(
      trackedFeatures({
        text: '$19.99',
        boundingBox: { xCenter: 0.2, yCenter: 0.3, width: 0.1, height: 0.03 },
        regexFlags: { isPriceLike: true, isNameLike: false },
      }),
    );
    expect(result.category).toBe('price');
    expect(result.categoryConfidence).toBe(1);
  });

  it('classifies a Title-Case short string near a face as a name', () => {
    const result = classifyOcrTrack(
      trackedFeatures({
        text: 'John Smith',
        regexFlags: { isPriceLike: false, isNameLike: true },
        nearFace: true,
      }),
    );
    expect(result.category).toBe('name');
    expect(result.categoryConfidence).toBe(1);
  });

  it('gives a name-shaped string with no face data at all only partial (capped) credit, not a confident name classification', () => {
    const result = classifyOcrTrack(
      trackedFeatures({
        text: 'John Smith',
        regexFlags: { isPriceLike: false, isNameLike: true },
        nearFace: null,
      }),
    );
    expect(result.categoryConfidence).toBeLessThanOrEqual(0.5);
  });

  it('falls back to caption for an ordinary mid-frame text overlay matching no other category', () => {
    const result = classifyOcrTrack(
      trackedFeatures({
        text: 'watch until the end',
        boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.15, height: 0.04 },
        persistenceScore: 0.3,
        motionScore: 0.5,
      }),
    );
    expect(result.category).toBe('caption');
  });

  it('always sets classificationMethod to HybridRuleEngine', () => {
    const result = classifyOcrTrack(trackedFeatures());
    expect(result.classificationMethod).toBe('HybridRuleEngine');
  });
});
