import type { FusionBreakdown, FusionFactor } from '@speedora/shared';
import {
  formatConfidence,
  groupBreakdownBySignal,
  predictionBadge,
  sortTopFactors,
  toPercent,
} from './explainability';

describe('groupBreakdownBySignal', () => {
  it('groups contributions by signal and sums their weighted contribution', () => {
    const breakdown: FusionBreakdown = [
      {
        signal: 'audio',
        feature: 'averageRmsDb',
        rawValue: -18,
        normalizedValue: 0.7,
        weight: 0.175,
        weightedContribution: 0.1225,
      },
      {
        signal: 'audio',
        feature: 'speakingRateStdDev',
        rawValue: 0.3,
        normalizedValue: 0.5,
        weight: 0.175,
        weightedContribution: 0.0875,
      },
      {
        signal: 'scene',
        feature: 'cutsPerMinute',
        rawValue: 4,
        normalizedValue: 0.6,
        weight: 0.25,
        weightedContribution: 0.15,
      },
    ];

    const groups = groupBreakdownBySignal(breakdown);

    expect(groups).toHaveLength(2);
    const scene = groups.find((g) => g.signal === 'scene')!;
    const audio = groups.find((g) => g.signal === 'audio')!;
    expect(scene.totalWeightedContribution).toBeCloseTo(0.15);
    expect(audio.totalWeightedContribution).toBeCloseTo(0.21);
    expect(audio.features).toHaveLength(2);
    // averageNormalizedValue = mean(0.7, 0.5) = 0.6, independent of weight.
    expect(audio.averageNormalizedValue).toBeCloseTo(0.6);
  });

  it('sorts groups by total weighted contribution descending', () => {
    const breakdown: FusionBreakdown = [
      {
        signal: 'low',
        feature: 'x',
        rawValue: 0,
        normalizedValue: 0.1,
        weight: 0.1,
        weightedContribution: 0.01,
      },
      {
        signal: 'high',
        feature: 'y',
        rawValue: 0,
        normalizedValue: 0.9,
        weight: 0.5,
        weightedContribution: 0.45,
      },
    ];

    const groups = groupBreakdownBySignal(breakdown);

    expect(groups.map((g) => g.signal)).toEqual(['high', 'low']);
  });

  it('marks a weight-0 signal as not active, not hidden', () => {
    const breakdown: FusionBreakdown = [
      {
        signal: 'composition',
        feature: 'ruleOfThirdsScore',
        rawValue: 0.5,
        normalizedValue: 0.5,
        weight: 0,
        weightedContribution: 0,
      },
    ];

    const groups = groupBreakdownBySignal(breakdown);

    expect(groups).toHaveLength(1);
    expect(groups[0].active).toBe(false);
  });

  it('returns an empty array for an empty breakdown', () => {
    expect(groupBreakdownBySignal([])).toEqual([]);
  });
});

describe('toPercent', () => {
  it('converts a normalizedValue to a rounded percentage', () => {
    expect(toPercent(0.5)).toBe(50);
    expect(toPercent(0.873)).toBe(87);
  });

  it('clamps values outside [0, 1]', () => {
    expect(toPercent(1.5)).toBe(100);
    expect(toPercent(-0.5)).toBe(0);
  });
});

describe('formatConfidence', () => {
  it('formats a confidence as a rounded percentage', () => {
    expect(formatConfidence(0.82)).toBe('82%');
    expect(formatConfidence(1)).toBe('100%');
    expect(formatConfidence(0)).toBe('0%');
  });

  it('returns a not-available label for null', () => {
    expect(formatConfidence(null)).toBe('Tidak tersedia');
  });
});

describe('predictionBadge', () => {
  it('maps each bucket to a label and tone', () => {
    expect(predictionBadge('likely_high_performer')).toEqual({
      label: 'Berpotensi Tinggi',
      tone: 'good',
    });
    expect(predictionBadge('uncertain')).toEqual({ label: 'Belum Pasti', tone: 'neutral' });
    expect(predictionBadge('likely_low_performer')).toEqual({
      label: 'Berpotensi Rendah',
      tone: 'bad',
    });
  });

  it('returns an unknown badge for null/undefined', () => {
    expect(predictionBadge(null)).toEqual({ label: 'Tidak diketahui', tone: 'neutral' });
    expect(predictionBadge(undefined)).toEqual({ label: 'Tidak diketahui', tone: 'neutral' });
  });
});

describe('sortTopFactors', () => {
  it('sorts by absolute weightedContribution descending', () => {
    const factors: FusionFactor[] = [
      { signal: 'audio', feature: 'a', weightedContribution: 0.1, description: 'a' },
      { signal: 'scene', feature: 'b', weightedContribution: -0.5, description: 'b' },
      { signal: 'facial', feature: 'c', weightedContribution: 0.3, description: 'c' },
    ];

    const sorted = sortTopFactors(factors);

    expect(sorted.map((f) => f.feature)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const factors: FusionFactor[] = [
      { signal: 'audio', feature: 'a', weightedContribution: 0.1, description: 'a' },
      { signal: 'scene', feature: 'b', weightedContribution: 0.5, description: 'b' },
    ];
    const original = [...factors];

    sortTopFactors(factors);

    expect(factors).toEqual(original);
  });
});
