import type { FusionWeights } from '@speedora/contracts';
import type { DatasetRecord, TimestampedRecord } from './flatten';

// Milestone 1.5 (Dataset Validation & Calibration): pure calculation
// functions consumed by apps/worker's generate-dataset-report.ts's six
// report sections, moved here verbatim in Milestone 5C-B so apps/api's new
// AI Operations Dashboard (GET /ops/ai/*) can reuse the exact same logic. No
// DB/prisma import here - every function takes already-loaded,
// already-flattened records (see each app's own Prisma-touching adapter),
// matching the module/adapter test split in docs/testing.md.

// 'createdAt' shows up as an own key when computeMissingDataReport/
// computeFeatureDistribution are called with detectFeatureDrift's
// timestamp-augmented records - excluded here so it's never mistaken for a
// genuinely-missing numeric feature.
function isFeatureKey(key: string): boolean {
  return key !== 'clipId' && key !== 'createdAt';
}

function numericValuesFor(records: DatasetRecord[], feature: string): number[] {
  return records.map((r) => r[feature]).filter((v): v is number => typeof v === 'number');
}

export interface MissingDataEntry {
  feature: string;
  presentCount: number;
  missingCount: number;
  missingRatePct: number;
}

// For every feature key seen anywhere in `records`, how often it's actually
// present vs. missing across the full `totalCount` of clips considered.
// Surfaces exactly the kind of gap already called out in
// packages/fusion-engine/src/weights.ts's comments (e.g. `composition` has
// no caller anywhere in apps/worker yet, so compositionFeatures should show
// ~100% missing here) without needing to read source comments to know it.
export function computeMissingDataReport(
  records: DatasetRecord[],
  totalCount: number,
): MissingDataEntry[] {
  if (totalCount === 0) return [];

  const featureKeys = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (isFeatureKey(key)) featureKeys.add(key);
    }
  }

  return [...featureKeys]
    .map((feature) => {
      const presentCount = records.filter((r) => typeof r[feature] === 'number').length;
      const missingCount = totalCount - presentCount;
      return {
        feature,
        presentCount,
        missingCount,
        missingRatePct: Math.round((missingCount / totalCount) * 1000) / 10,
      };
    })
    .sort((a, b) => b.missingRatePct - a.missingRatePct);
}

export interface FeatureDistributionEntry {
  feature: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  p25: number;
  p75: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

// Per numeric feature key: summary stats over every present (non-null)
// value. Every Fusion Engine signal feature should sit in [0, 1] per
// feature-pipeline.ts's NORMALIZERS registry - a feature whose observed
// range violates that is a real normalization bug, not just noise.
export function computeFeatureDistribution(records: DatasetRecord[]): FeatureDistributionEntry[] {
  const featureKeys = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (isFeatureKey(key)) featureKeys.add(key);
    }
  }

  const entries: FeatureDistributionEntry[] = [];
  for (const feature of featureKeys) {
    const values = numericValuesFor(records, feature);
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    entries.push({
      feature,
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: percentile(sorted, 0.5),
      stddev: Math.sqrt(variance),
      p25: percentile(sorted, 0.25),
      p75: percentile(sorted, 0.75),
    });
  }
  return entries.sort((a, b) => a.feature.localeCompare(b.feature));
}

export interface FeatureDriftEntry {
  feature: string;
  meanEarlier: number;
  meanLater: number;
  relativeDeltaPct: number;
  drifted: boolean;
}

export type FeatureDriftResult =
  { insufficientData: true } | { insufficientData: false; entries: FeatureDriftEntry[] };

const MIN_TOTAL_FOR_DRIFT = 10;
const MIN_PER_BUCKET_FOR_DRIFT = 5;
// Heuristic, unvalidated - same "scale honesty" caveat as every other
// threshold in this codebase's calibration tooling. A feature whose mean
// moved by more than a quarter, relative to its earlier mean, between the
// two halves of the dataset (split by createdAt) is flagged for a human to
// look at - not proof of a real regression.
const DRIFT_THRESHOLD_PCT = 25;

// Splits records by createdAt at the median index into "earlier"/"later"
// halves and compares each feature's mean between them. Detects silent
// upstream shifts (a detector/model update that changes a feature's typical
// value without anyone noticing) before they contaminate calibration.
export function detectFeatureDrift(records: TimestampedRecord[]): FeatureDriftResult {
  if (records.length < MIN_TOTAL_FOR_DRIFT) return { insufficientData: true };

  const sorted = [...records].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const mid = Math.floor(sorted.length / 2);
  const earlier = sorted.slice(0, mid).map((r) => r.record);
  const later = sorted.slice(mid).map((r) => r.record);

  const featureKeys = new Set<string>();
  for (const { record } of records) {
    for (const key of Object.keys(record)) {
      if (isFeatureKey(key)) featureKeys.add(key);
    }
  }

  const entries: FeatureDriftEntry[] = [];
  for (const feature of featureKeys) {
    const earlierValues = numericValuesFor(earlier, feature);
    const laterValues = numericValuesFor(later, feature);
    if (
      earlierValues.length < MIN_PER_BUCKET_FOR_DRIFT ||
      laterValues.length < MIN_PER_BUCKET_FOR_DRIFT
    ) {
      continue;
    }
    const meanEarlier = earlierValues.reduce((sum, v) => sum + v, 0) / earlierValues.length;
    const meanLater = laterValues.reduce((sum, v) => sum + v, 0) / laterValues.length;
    if (meanEarlier === 0) continue;
    const relativeDeltaPct = ((meanLater - meanEarlier) / Math.abs(meanEarlier)) * 100;
    entries.push({
      feature,
      meanEarlier,
      meanLater,
      relativeDeltaPct: Math.round(relativeDeltaPct * 10) / 10,
      drifted: Math.abs(relativeDeltaPct) > DRIFT_THRESHOLD_PCT,
    });
  }

  return {
    insufficientData: false,
    entries: entries.sort((a, b) => Math.abs(b.relativeDeltaPct) - Math.abs(a.relativeDeltaPct)),
  };
}

export interface WeightCalibrationEntry {
  signal: string;
  currentWeight: number;
  suggestedWeight: number;
  sampleFeatureCount: number;
}

// Groups correlation results by their `signal.` prefix, averages |correlation|
// per signal, and normalizes those averages to sum to 1.0 - the same total-
// mass convention DEFAULT_FUSION_WEIGHTS uses. This is a heuristic
// *suggestion* for a human to review against packages/fusion-engine/src/
// weights.ts, not something that auto-edits it - matches the "every change
// validated against real behavior, not auto-applied" spirit already
// established there for editingRhythm's own weight history.
export function computeWeightCalibrationSuggestions(
  correlations: Array<{ feature: string; correlation: number }>,
  currentWeights: FusionWeights,
): WeightCalibrationEntry[] {
  const bySignal = new Map<string, number[]>();
  for (const { feature, correlation } of correlations) {
    const signal = feature.split('.')[0];
    if (!bySignal.has(signal)) bySignal.set(signal, []);
    bySignal.get(signal)!.push(Math.abs(correlation));
  }

  const avgAbsCorrelationBySignal = new Map<string, number>();
  for (const [signal, values] of bySignal) {
    avgAbsCorrelationBySignal.set(signal, values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  const totalMass = [...avgAbsCorrelationBySignal.values()].reduce((sum, v) => sum + v, 0);
  if (totalMass === 0) {
    return [...bySignal.keys()].map((signal) => ({
      signal,
      currentWeight: currentWeights[signal as keyof FusionWeights] ?? 0,
      suggestedWeight: 0,
      sampleFeatureCount: bySignal.get(signal)!.length,
    }));
  }

  return [...avgAbsCorrelationBySignal.entries()]
    .map(([signal, avgAbsCorrelation]) => ({
      signal,
      currentWeight: currentWeights[signal as keyof FusionWeights] ?? 0,
      suggestedWeight: Math.round((avgAbsCorrelation / totalMass) * 1000) / 1000,
      sampleFeatureCount: bySignal.get(signal)!.length,
    }))
    .sort((a, b) => b.suggestedWeight - a.suggestedWeight);
}
