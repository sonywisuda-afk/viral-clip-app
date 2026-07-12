// Milestone 5C-B: this file's pure functions (computeMissingDataReport,
// computeFeatureDistribution, detectFeatureDrift,
// computeWeightCalibrationSuggestions) moved verbatim to
// @speedora/dataset-quality so apps/api's new AI Operations Dashboard
// (GET /ops/ai/*) can reuse the exact same, already-tested logic without
// importing across apps (apps only talk over HTTP/queue). Re-exported here
// so generate-dataset-report.ts and dataset-quality.spec.ts keep working
// unmodified. See docs/ai/dataset-validation-calibration.md.
export * from '@speedora/dataset-quality';
