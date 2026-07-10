import type { OcrTextCategory, OcrTextTrack } from '@speedora/contracts';
import { evaluateOcrClassification, type OcrLabeledTrack } from './evaluate-ocr-classification';

// Synthetic fixtures only - see this module's own header comment for why:
// no real annotated dataset (100-300 videos / 3,000-10,000 labeled OCR
// regions) exists in this environment. These fixtures exist purely to
// prove the metrics math is correct, not to claim anything about the
// HybridRuleEngine classifier's real-world quality.

function track(
  category: OcrTextCategory,
  categoryConfidence: number,
  overrides: Partial<OcrTextTrack> = {},
): OcrTextTrack {
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
    category,
    categoryConfidence,
    classificationMethod: 'HybridRuleEngine',
    ...overrides,
  };
}

function labeled(
  actualCategory: OcrTextCategory,
  predictedCategory: OcrTextCategory,
  categoryConfidence: number,
): OcrLabeledTrack {
  return { track: track(predictedCategory, categoryConfidence), actualCategory };
}

describe('evaluateOcrClassification', () => {
  it('returns an all-null/zeroed report for an empty labeled set', () => {
    const report = evaluateOcrClassification([]);
    expect(report.totalLabeled).toBe(0);
    expect(report.overallAccuracy).toBeNull();
    expect(report.confusionMatrix.matrix.subtitle.subtitle).toBe(0);
    for (const metrics of report.perCategoryMetrics) {
      expect(metrics.support).toBe(0);
      expect(metrics.precision).toBeNull();
      expect(metrics.recall).toBeNull();
      expect(metrics.f1).toBeNull();
    }
  });

  it('computes overall accuracy from correct vs incorrect predictions', () => {
    const report = evaluateOcrClassification([
      labeled('subtitle', 'subtitle', 0.9),
      labeled('subtitle', 'subtitle', 0.8),
      labeled('price', 'name', 0.6),
      labeled('logo', 'logo', 0.7),
    ]);
    expect(report.totalLabeled).toBe(4);
    expect(report.overallAccuracy).toBe(3 / 4);
  });

  it('builds a confusion matrix keyed by [actual][predicted]', () => {
    const report = evaluateOcrClassification([
      labeled('subtitle', 'subtitle', 0.9),
      labeled('subtitle', 'caption', 0.5),
      labeled('caption', 'caption', 0.6),
    ]);
    expect(report.confusionMatrix.matrix.subtitle.subtitle).toBe(1);
    expect(report.confusionMatrix.matrix.subtitle.caption).toBe(1);
    expect(report.confusionMatrix.matrix.caption.caption).toBe(1);
    expect(report.confusionMatrix.matrix.caption.subtitle).toBe(0);
  });

  it('computes precision/recall/F1 for a category with a mix of correct and incorrect predictions', () => {
    // "price" predicted 3 times: 2 correct (actual=price), 1 wrong (actual=name predicted as price)
    // "price" actually occurs 3 times: 2 predicted correctly, 1 predicted as "name" (missed)
    const report = evaluateOcrClassification([
      labeled('price', 'price', 0.9),
      labeled('price', 'price', 0.8),
      labeled('price', 'name', 0.5),
      labeled('name', 'price', 0.6),
    ]);
    const priceMetrics = report.perCategoryMetrics.find((m) => m.category === 'price')!;
    // predicted as price: 3 (2 correct + 1 from actual=name) -> precision = 2/3
    expect(priceMetrics.precision).toBeCloseTo(2 / 3);
    // actual price: 3 (2 correct + 1 predicted as name) -> recall = 2/3
    expect(priceMetrics.recall).toBeCloseTo(2 / 3);
    expect(priceMetrics.f1).toBeCloseTo(2 / 3);
    expect(priceMetrics.support).toBe(3);
  });

  it('returns null precision when a category is never predicted', () => {
    const report = evaluateOcrClassification([labeled('subtitle', 'subtitle', 0.9)]);
    const logoMetrics = report.perCategoryMetrics.find((m) => m.category === 'logo')!;
    expect(logoMetrics.support).toBe(0);
    expect(logoMetrics.precision).toBeNull();
    expect(logoMetrics.recall).toBeNull();
    expect(logoMetrics.f1).toBeNull();
  });

  it('returns null recall (but a real precision) when a category is predicted but never actually occurs', () => {
    const report = evaluateOcrClassification([labeled('name', 'logo', 0.7)]);
    const logoMetrics = report.perCategoryMetrics.find((m) => m.category === 'logo')!;
    expect(logoMetrics.support).toBe(0);
    expect(logoMetrics.precision).toBe(0);
    expect(logoMetrics.recall).toBeNull();
    expect(logoMetrics.f1).toBeNull();
  });

  it('buckets predictions by confidence into calibration buckets with count/averageConfidence/accuracy', () => {
    const report = evaluateOcrClassification([
      labeled('subtitle', 'subtitle', 0.95), // bucket 9 (0.9-1.0), correct
      labeled('price', 'name', 0.92), // bucket 9 (0.9-1.0), incorrect
      labeled('logo', 'logo', 0.25), // bucket 2 (0.2-0.3), correct
    ]);
    const topBucket = report.calibrationBuckets[9];
    expect(topBucket.count).toBe(2);
    expect(topBucket.averageConfidence).toBeCloseTo((0.95 + 0.92) / 2);
    expect(topBucket.accuracy).toBe(0.5);

    const lowBucket = report.calibrationBuckets[2];
    expect(lowBucket.count).toBe(1);
    expect(lowBucket.averageConfidence).toBeCloseTo(0.25);
    expect(lowBucket.accuracy).toBe(1);

    const emptyBucket = report.calibrationBuckets[5];
    expect(emptyBucket.count).toBe(0);
    expect(emptyBucket.averageConfidence).toBeNull();
    expect(emptyBucket.accuracy).toBeNull();
  });

  it('includes a confidence of exactly 1.0 in the last bucket', () => {
    const report = evaluateOcrClassification([labeled('subtitle', 'subtitle', 1)]);
    expect(report.calibrationBuckets[9].count).toBe(1);
  });

  it('produces 10 calibration buckets covering [0,1] with no gaps', () => {
    const report = evaluateOcrClassification([]);
    expect(report.calibrationBuckets).toHaveLength(10);
    expect(report.calibrationBuckets[0].bucketMin).toBe(0);
    expect(report.calibrationBuckets[9].bucketMax).toBe(1);
    for (let i = 1; i < 10; i++) {
      expect(report.calibrationBuckets[i].bucketMin).toBeCloseTo(
        report.calibrationBuckets[i - 1].bucketMax,
      );
    }
  });
});
