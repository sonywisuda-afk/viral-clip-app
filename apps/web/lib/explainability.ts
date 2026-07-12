import type { FusionBreakdown, FusionContribution, FusionFactor, PredictionBucket } from '@speedora/shared';

// Milestone 4 (AI Explainability) - pure, no-JSX helpers for the
// explainability page/components. Kept separate from the components so
// they're testable without a component-testing framework (apps/web has
// none today - see lib/explainability.spec.ts and jest.config.js).

export interface SignalGroup {
  signal: string;
  // Mean of this signal's features' normalizedValue (0-1) - "how strong is
  // this signal's own raw reading," scale-honest and independent of
  // whether it currently has any weight. The right quantity for a bar
  // WIDTH; totalWeightedContribution (below) is the right quantity for
  // "how much did this actually move highlightScore," which is a much
  // smaller, weight-scaled number and would make a misleading bar.
  averageNormalizedValue: number;
  totalWeightedContribution: number;
  active: boolean;
  features: FusionContribution[];
}

// Groups a clip's highlightBreakdown by signal, sorted by total weighted
// contribution descending - the signals actually moving highlightScore
// float to the top. `active` is false for weight-0 signals (collected by
// the Fusion Engine but not yet calibrated - see docs/ai/fusion.md) -
// surfaced to the UI rather than hidden, same transparency the Fusion
// Engine's own `contributions` array already provides.
export function groupBreakdownBySignal(breakdown: FusionBreakdown): SignalGroup[] {
  const bySignal = new Map<string, FusionContribution[]>();
  for (const contribution of breakdown) {
    const existing = bySignal.get(contribution.signal) ?? [];
    existing.push(contribution);
    bySignal.set(contribution.signal, existing);
  }

  // Array.from(), not [...bySignal.entries()] - this app's tsconfig has no
  // explicit `target`, so a Map spread needs `downlevelIteration`/ES2015+
  // it doesn't have (TS2802); Array.from() doesn't hit that restriction.
  const groups: SignalGroup[] = Array.from(bySignal.entries()).map(([signal, features]) => ({
    signal,
    averageNormalizedValue: features.reduce((sum, f) => sum + f.normalizedValue, 0) / features.length,
    totalWeightedContribution: features.reduce((sum, f) => sum + f.weightedContribution, 0),
    active: features.some((f) => f.weight > 0),
    features,
  }));

  return groups.sort((a, b) => b.totalWeightedContribution - a.totalWeightedContribution);
}

// Clamped to [0, 100] - a normalizedValue is already meant to be in [0, 1],
// but this stays defensive against a future signal whose normalizer has a
// bug, rather than rendering a bar wider than its container.
export function toPercent(normalizedValue: number): number {
  return Math.round(Math.min(1, Math.max(0, normalizedValue)) * 100);
}

// highlightConfidence is "a heuristic coverage+quality estimate, not a
// calibrated probability" (packages/shared's own type comment) - formatted
// as a percentage for display, but the caller is responsible for pairing
// this with that caveat in the UI, not presenting it as a bare number that
// implies more precision than it has.
export function formatConfidence(confidence: number | null): string {
  if (confidence === null) return 'Tidak tersedia';
  return `${Math.round(confidence * 100)}%`;
}

export interface PredictionBadge {
  label: string;
  tone: 'good' | 'neutral' | 'bad';
}

const PREDICTION_BADGES: Record<PredictionBucket, PredictionBadge> = {
  likely_high_performer: { label: 'Berpotensi Tinggi', tone: 'good' },
  uncertain: { label: 'Belum Pasti', tone: 'neutral' },
  likely_low_performer: { label: 'Berpotensi Rendah', tone: 'bad' },
};

export function predictionBadge(bucket: PredictionBucket | null | undefined): PredictionBadge {
  if (!bucket) return { label: 'Tidak diketahui', tone: 'neutral' };
  return PREDICTION_BADGES[bucket];
}

// highlightExplainability.topFactors is already sorted by the Fusion Engine
// (see packages/fusion-engine/src/compute-highlight-score.ts), but this
// stays defensive rather than assuming the API's ordering forever.
export function sortTopFactors(factors: FusionFactor[]): FusionFactor[] {
  return [...factors].sort(
    (a, b) => Math.abs(b.weightedContribution) - Math.abs(a.weightedContribution),
  );
}
