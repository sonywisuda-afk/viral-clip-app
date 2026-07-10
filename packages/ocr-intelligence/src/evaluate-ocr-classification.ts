import { OCR_TEXT_CATEGORIES, type OcrLabeledTrack, type OcrTextCategory } from '@speedora/contracts';

// AI Fusion roadmap's OCR initiative, Batch OCR-2.5 (Calibration &
// Evaluation) - user's own explicit direction, inserted BEFORE OCR-3
// (object-detector integration): "Sebelum menambah object detector, saya
// akan membuat tooling untuk mengukur apakah aturan yang ada memang
// bekerja" (before adding an object detector, build tooling to measure
// whether the existing rules actually work). This module is that tooling
// - it does NOT touch classify-ocr-text.ts's rules at all, it only
// MEASURES them against externally-supplied ground truth.
//
// HONEST GAP, stated up front: this environment has no real annotated
// dataset (user's own target is 100-300 videos / 3,000-10,000 labeled OCR
// regions) - that requires actual human annotation work against real
// video, which cannot be fabricated here. What this batch DOES deliver:
// (1) a defined ground-truth input shape (OcrLabeledTrack below) so a
// human annotator has a concrete format to produce, (2) the metrics
// computation itself (confusion matrix, precision/recall/F1 per category,
// confidence calibration, confidence distribution), fully implemented and
// unit-tested against hand-written synthetic examples, ready to run
// against a real dataset the moment one exists - see
// apps/worker/src/scripts/evaluate-ocr-classification.ts for the runnable
// CLI entry point. Nothing in this module fabricates or assumes a result
// about real-world classifier quality - see this module's own report
// shape for how "no data for this category" honestly reads as null, not
// a fabricated 0 or 1.

// OcrLabeledTrack (one already-classified track paired with a human-
// provided ground-truth actualCategory) is defined in @speedora/contracts,
// not here - see ocrLabeledTrackSchema for why (lets an external consumer,
// e.g. a CLI script, validate a labeled-data file without depending on zod
// itself). Re-exported from this module for convenience.
export type { OcrLabeledTrack };

export interface OcrConfusionMatrix {
  // matrix[actualCategory][predictedCategory] = count - standard
  // confusion-matrix orientation (rows = ground truth, columns =
  // predictions).
  matrix: Record<OcrTextCategory, Record<OcrTextCategory, number>>;
}

export interface OcrCategoryMetrics {
  category: OcrTextCategory;
  // Count of labeled examples whose ACTUAL category is this one -
  // standard ML reporting term ("support"). 0 is a real, meaningful value
  // (this category never appeared in the labeled set at all).
  support: number;
  // TP / (TP + FP) - null when this category was NEVER predicted at all
  // (undefined, not 0 - "we don't know how precise this category's
  // predictions are because there weren't any").
  precision: number | null;
  // TP / (TP + FN) - null when support is 0 (nothing to recall).
  recall: number | null;
  // Harmonic mean of precision/recall - null whenever either input is
  // null, or when precision+recall is exactly 0 (both null since that
  // combination is impossible without both already being 0, but guarded
  // explicitly rather than dividing by zero).
  f1: number | null;
}

// One confidence bucket's worth of calibration data - a reliability-
// diagram row. A well-calibrated classifier has averageConfidence close
// to accuracy in every bucket (e.g. predictions the classifier reports as
// "90% confident" really are correct about 90% of the time); a gap
// between them means the classifier's categoryConfidence numbers are
// systematically over- or under-confident, not just imprecise labels.
export interface OcrConfidenceCalibrationBucket {
  bucketMin: number;
  bucketMax: number;
  // How many predictions fell into this confidence bucket - this IS the
  // confidence distribution user asked for; a separate structure would
  // just repeat the same counts.
  count: number;
  averageConfidence: number | null;
  // Fraction of this bucket's predictions where category === actualCategory.
  accuracy: number | null;
}

export interface OcrEvaluationReport {
  totalLabeled: number;
  // Fraction of ALL labeled tracks where category === actualCategory -
  // null only when totalLabeled is 0 (nothing to evaluate at all).
  overallAccuracy: number | null;
  confusionMatrix: OcrConfusionMatrix;
  perCategoryMetrics: OcrCategoryMetrics[];
  calibrationBuckets: OcrConfidenceCalibrationBucket[];
}

const CALIBRATION_BUCKET_COUNT = 10;

function emptyConfusionMatrix(): OcrConfusionMatrix {
  const matrix = {} as Record<OcrTextCategory, Record<OcrTextCategory, number>>;
  for (const actual of OCR_TEXT_CATEGORIES) {
    matrix[actual] = {} as Record<OcrTextCategory, number>;
    for (const predicted of OCR_TEXT_CATEGORIES) {
      matrix[actual][predicted] = 0;
    }
  }
  return { matrix };
}

// Pure, synchronous - no I/O, no randomness, so the same labeled dataset
// always produces the exact same report (needed for this to be a
// trustworthy before/after comparison as classify-ocr-text.ts's rules get
// tuned later).
export function evaluateOcrClassification(labeled: OcrLabeledTrack[]): OcrEvaluationReport {
  const totalLabeled = labeled.length;
  const { matrix } = emptyConfusionMatrix();

  let correctCount = 0;
  for (const { track, actualCategory } of labeled) {
    matrix[actualCategory][track.category]++;
    if (track.category === actualCategory) correctCount++;
  }

  const overallAccuracy = totalLabeled === 0 ? null : correctCount / totalLabeled;

  const perCategoryMetrics: OcrCategoryMetrics[] = OCR_TEXT_CATEGORIES.map((category) => {
    // support = count of labeled examples whose ACTUAL category is
    // `category` - sum across matrix[category][*] (that row).
    const actualCount = OCR_TEXT_CATEGORIES.reduce(
      (sum, predicted) => sum + matrix[category][predicted],
      0,
    );
    const predictedCount = OCR_TEXT_CATEGORIES.reduce(
      (sum, actual) => sum + matrix[actual][category],
      0,
    );
    const truePositives = matrix[category][category];

    const precision = predictedCount === 0 ? null : truePositives / predictedCount;
    const recall = actualCount === 0 ? null : truePositives / actualCount;
    const f1 =
      precision === null || recall === null || precision + recall === 0
        ? null
        : (2 * precision * recall) / (precision + recall);

    return { category, support: actualCount, precision, recall, f1 };
  });

  const bucketSize = 1 / CALIBRATION_BUCKET_COUNT;
  const calibrationBuckets: OcrConfidenceCalibrationBucket[] = Array.from(
    { length: CALIBRATION_BUCKET_COUNT },
    (_, i) => {
      const bucketMin = i * bucketSize;
      // Last bucket includes 1.0 itself (categoryConfidence is inclusive
      // [0,1], so a perfect-confidence prediction needs a home).
      const bucketMax = i === CALIBRATION_BUCKET_COUNT - 1 ? 1 : bucketMin + bucketSize;
      const inBucket = labeled.filter(({ track }) => {
        const confidence = track.categoryConfidence;
        return i === CALIBRATION_BUCKET_COUNT - 1
          ? confidence >= bucketMin && confidence <= bucketMax
          : confidence >= bucketMin && confidence < bucketMax;
      });
      const count = inBucket.length;
      const averageConfidence =
        count === 0
          ? null
          : inBucket.reduce((sum, { track }) => sum + track.categoryConfidence, 0) / count;
      const accuracy =
        count === 0
          ? null
          : inBucket.filter(({ track, actualCategory }) => track.category === actualCategory)
              .length / count;
      return { bucketMin, bucketMax, count, averageConfidence, accuracy };
    },
  );

  return {
    totalLabeled,
    overallAccuracy,
    confusionMatrix: { matrix },
    perCategoryMetrics,
    calibrationBuckets,
  };
}
