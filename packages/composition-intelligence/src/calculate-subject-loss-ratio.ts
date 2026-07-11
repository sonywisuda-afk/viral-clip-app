import type { CompositionSample } from '@speedora/contracts';

// Batch RB-1 - fraction of ALL samples (not just the ones with a
// subjectBox) where subjectBox was null: "how much of the clip did the
// camera fail to keep any subject in frame". A framing-failure read,
// distinct in INTENT from @speedora/object-intelligence's
// averageTrackingConfidence (a tracker-robustness read), even though both
// are ultimately computed from the same underlying per-frame presence
// data - see docs/ai/composition-intelligence.md's RB-1 section. Null
// only when there are zero samples at all (nothing to compute a ratio
// over) - a real 0 (subject visible every sample) or 1 (never visible) is
// a meaningful value, not "unknown".
export function calculateSubjectLossRatio(samples: CompositionSample[]): number | null {
  if (samples.length === 0) return null;
  const missing = samples.filter((sample) => sample.subjectBox === null).length;
  return missing / samples.length;
}
