import type { DatasetRecord, TimestampedRecord } from './flatten';
import {
  computeFeatureDistribution,
  computeMissingDataReport,
  computeWeightCalibrationSuggestions,
  detectFeatureDrift,
} from './quality';

describe('computeMissingDataReport', () => {
  it('returns an empty array when there are no clips', () => {
    expect(computeMissingDataReport([], 0)).toEqual([]);
  });

  it('computes present/missing counts and rate per feature key', () => {
    const records: DatasetRecord[] = [
      { clipId: 'a', 'audio.loudness': 0.5, 'composition.ruleOfThirdsScore': 0.9 },
      { clipId: 'b', 'audio.loudness': 0.3 },
      { clipId: 'c' },
    ];

    const report = computeMissingDataReport(records, 3);

    expect(report).toEqual([
      { feature: 'composition.ruleOfThirdsScore', presentCount: 1, missingCount: 2, missingRatePct: 66.7 },
      { feature: 'audio.loudness', presentCount: 2, missingCount: 1, missingRatePct: 33.3 },
    ]);
  });
});

describe('computeFeatureDistribution', () => {
  it('skips features with no numeric values at all', () => {
    expect(computeFeatureDistribution([{ clipId: 'a' }])).toEqual([]);
  });

  it('computes summary stats for a known small array', () => {
    // [10, 20, 30, 40, 50]: mean 30, median 30, p25 20, p75 40
    const records: DatasetRecord[] = [
      { clipId: 'a', x: 10 },
      { clipId: 'b', x: 20 },
      { clipId: 'c', x: 30 },
      { clipId: 'd', x: 40 },
      { clipId: 'e', x: 50 },
    ];

    const [entry] = computeFeatureDistribution(records);

    expect(entry.feature).toBe('x');
    expect(entry.count).toBe(5);
    expect(entry.min).toBe(10);
    expect(entry.max).toBe(50);
    expect(entry.mean).toBe(30);
    expect(entry.median).toBe(30);
    expect(entry.p25).toBe(20);
    expect(entry.p75).toBe(40);
    expect(entry.stddev).toBeCloseTo(Math.sqrt(200));
  });
});

describe('detectFeatureDrift', () => {
  function record(clipId: string, x: number, daysAgo: number): TimestampedRecord {
    return { record: { clipId, x }, createdAt: new Date(Date.now() - daysAgo * 86_400_000) };
  }

  it('reports insufficientData below the total-record floor', () => {
    const records = Array.from({ length: 9 }, (_, i) => record(`c${i}`, 1, i));
    expect(detectFeatureDrift(records)).toEqual({ insufficientData: true });
  });

  it('flags a feature whose mean shifted more than the threshold between halves', () => {
    // Earlier half (older, higher daysAgo): x around 1. Later half: x around 2 (100% shift).
    const earlier = Array.from({ length: 5 }, (_, i) => record(`old${i}`, 1, 20 - i));
    const later = Array.from({ length: 5 }, (_, i) => record(`new${i}`, 2, 10 - i));
    const records = [...earlier, ...later];

    const result = detectFeatureDrift(records);

    expect(result.insufficientData).toBe(false);
    if (result.insufficientData) throw new Error('unreachable');
    const entry = result.entries.find((e) => e.feature === 'x');
    expect(entry).toBeDefined();
    expect(entry!.meanEarlier).toBeCloseTo(1);
    expect(entry!.meanLater).toBeCloseTo(2);
    expect(entry!.drifted).toBe(true);
  });

  it('does not flag a feature whose mean is stable between halves', () => {
    const earlier = Array.from({ length: 5 }, (_, i) => record(`old${i}`, 1, 20 - i));
    const later = Array.from({ length: 5 }, (_, i) => record(`new${i}`, 1.05, 10 - i));
    const records = [...earlier, ...later];

    const result = detectFeatureDrift(records);

    expect(result.insufficientData).toBe(false);
    if (result.insufficientData) throw new Error('unreachable');
    const entry = result.entries.find((e) => e.feature === 'x');
    expect(entry!.drifted).toBe(false);
  });
});

describe('computeWeightCalibrationSuggestions', () => {
  it('normalizes average |correlation| per signal to sum to 1.0', () => {
    const correlations = [
      { feature: 'audio.loudness', correlation: 0.6 },
      { feature: 'audio.speakingRate', correlation: -0.4 },
      { feature: 'composition.ruleOfThirdsScore', correlation: 0.2 },
    ];

    const suggestions = computeWeightCalibrationSuggestions(correlations, { audio: 0.35, composition: 0 });

    const total = suggestions.reduce((sum, s) => sum + s.suggestedWeight, 0);
    expect(total).toBeCloseTo(1, 2);

    const audio = suggestions.find((s) => s.signal === 'audio')!;
    const composition = suggestions.find((s) => s.signal === 'composition')!;
    expect(audio.currentWeight).toBe(0.35);
    expect(composition.currentWeight).toBe(0);
    // audio's avg |correlation| is (0.6+0.4)/2=0.5, composition's is 0.2 - audio should suggest more.
    expect(audio.suggestedWeight).toBeGreaterThan(composition.suggestedWeight);
  });

  it('gives a currently-weight-0 signal a nonzero suggestion when it correlates strongly', () => {
    const correlations = [{ feature: 'gesture.handMovementRate', correlation: 0.8 }];

    const suggestions = computeWeightCalibrationSuggestions(correlations, { gesture: 0 });

    expect(suggestions).toEqual([
      { signal: 'gesture', currentWeight: 0, suggestedWeight: 1, sampleFeatureCount: 1 },
    ]);
  });

  it('returns zero suggestions for every signal when there are no correlations at all', () => {
    expect(computeWeightCalibrationSuggestions([], { audio: 0.35 })).toEqual([]);
  });
});
