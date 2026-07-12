import type { HistogramBucket, SignalContributionEntry } from './analytics';

// Milestone 5C-B (AI Operations Dashboard) - GET /ops/ai/* pools data across
// EVERY user's clips (unlike AnalyticsModule, which is strictly
// ownerId-scoped) so Correlation/Drift/Calibration/Readiness clear their
// statistical-sample floors immediately, matching M1.5's original scripts
// (apps/worker/src/scripts/generate-dataset-report.ts), which had zero
// per-user filtering from the start. Restricted to ADMIN/AI_ENGINEER/
// OPERATOR roles - see RolesGuard. Every response is wrapped
// `{ engine: 'v2', ... }` (mirrors ClipExplainabilityDto's `results` array
// precedent, Milestone 4) so a future Fusion v3 comparison doesn't need a
// redesign - today there is only ever a v2 entry.
export type OpsAiEngineVersion = 'v2' | 'v3';

// GET /ops/ai/health
export interface OpsAiHealthSnapshot {
  engine: OpsAiEngineVersion;
  totalClipsWithScore: number;
  averageConfidence: number | null;
  // Heuristic, unvalidated thresholds (0.5 / 0.8) - same "scale honesty"
  // caveat as every other threshold in this codebase's calibration tooling.
  lowConfidenceThreshold: number;
  highConfidenceThreshold: number;
  lowConfidenceClips: number;
  highConfidenceClips: number;
  // highlightScore present but explainability.topFactors is empty - a real
  // pipeline gap, not a heuristic.
  missingExplainability: number;
}
export interface OpsAiHealthDto {
  results: OpsAiHealthSnapshot[];
}

// GET /ops/ai/signals - per-signal average contribution % (same shape/logic
// as Milestone 5C-A's owner-scoped SignalContributionEntry, pooled
// system-wide here) plus Explainability Analytics (aggregated
// topFactors[].description frequency, e.g. "High Emotion 42%").
export interface ExplainabilityReasonEntry {
  description: string;
  count: number;
  pct: number;
}
export interface OpsAiSignalsSnapshot {
  engine: OpsAiEngineVersion;
  signalContributions: SignalContributionEntry[];
  explainabilityReasons: ExplainabilityReasonEntry[];
}
export interface OpsAiSignalsDto {
  results: OpsAiSignalsSnapshot[];
}

// GET /ops/ai/distribution - score/confidence histograms plus M1.5's
// per-feature distribution table and Feature Completeness (missing-data
// report).
export interface FeatureDistributionRow {
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
export interface FeatureCompletenessRow {
  feature: string;
  presentCount: number;
  missingCount: number;
  missingRatePct: number;
}
export interface OpsAiDistributionSnapshot {
  engine: OpsAiEngineVersion;
  scoreDistribution: HistogramBucket[];
  confidenceDistribution: HistogramBucket[];
  featureDistribution: FeatureDistributionRow[];
  featureCompleteness: FeatureCompletenessRow[];
}
export interface OpsAiDistributionDto {
  results: OpsAiDistributionSnapshot[];
}

// GET /ops/ai/correlation - M1.5's Correlation Dashboard. Honest
// "not enough samples yet" below minSamplesRequired - never a fabricated
// number ("Jangan memaksakan angka ketika sampel belum memadai").
export interface CorrelationRow {
  feature: string;
  correlation: number;
}
export interface OpsAiCorrelationSnapshot {
  engine: OpsAiEngineVersion;
  hasEnoughSamples: boolean;
  sampleCount: number;
  minSamplesRequired: number;
  correlations: CorrelationRow[];
}
export interface OpsAiCorrelationDto {
  results: OpsAiCorrelationSnapshot[];
}

// GET /ops/ai/calibration - M1.5's Weight Calibration Report. A heuristic
// *suggestion* for a human to review, never auto-applied. Same
// insufficient-data gating as correlation (calibration is derived from it).
export interface WeightCalibrationRow {
  signal: string;
  currentWeight: number;
  suggestedWeight: number;
  sampleFeatureCount: number;
}
export interface OpsAiCalibrationSnapshot {
  engine: OpsAiEngineVersion;
  hasEnoughSamples: boolean;
  sampleCount: number;
  minSamplesRequired: number;
  suggestions: WeightCalibrationRow[];
}
export interface OpsAiCalibrationDto {
  results: OpsAiCalibrationSnapshot[];
}

// GET /ops/ai/drift - M1.5's Feature Drift Detection.
export interface FeatureDriftRow {
  feature: string;
  meanEarlier: number;
  meanLater: number;
  relativeDeltaPct: number;
  drifted: boolean;
}
export interface OpsAiDriftSnapshot {
  engine: OpsAiEngineVersion;
  insufficientData: boolean;
  entries: FeatureDriftRow[];
}
export interface OpsAiDriftDto {
  results: OpsAiDriftSnapshot[];
}

// GET /ops/ai/readiness - new in Milestone 5C-B: a forward-looking verdict
// for "is there enough data to start M2C (Baseline ML Training)?".
// minSamplesRequired is a heuristic, explicitly higher than the correlation
// floor and unvalidated pending real ML training experience.
export interface OpsAiReadinessSnapshot {
  engine: OpsAiEngineVersion;
  ready: boolean;
  usableSamples: number;
  minSamplesRequired: number;
  blockers: string[];
}
export interface OpsAiReadinessDto {
  results: OpsAiReadinessSnapshot[];
}
