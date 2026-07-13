import {
  bucketByPublishDate,
  computeConfidenceDistribution,
  computeGrowthPct,
  computeMostCommonSignals,
} from './performance.util';

describe('computeConfidenceDistribution', () => {
  it('buckets confidences into 5 fixed-width ranges', () => {
    const result = computeConfidenceDistribution([0.1, 0.25, 0.5, 0.75, 0.95]);
    expect(result).toEqual([
      { bucket: '0.0-0.2', count: 1 },
      { bucket: '0.2-0.4', count: 1 },
      { bucket: '0.4-0.6', count: 1 },
      { bucket: '0.6-0.8', count: 1 },
      { bucket: '0.8-1.0', count: 1 },
    ]);
  });

  it('puts a confidence of exactly 1 in the last bucket, not overflowing', () => {
    const result = computeConfidenceDistribution([1]);
    expect(result[4].count).toBe(1);
  });

  it('returns all-zero buckets for an empty input', () => {
    const result = computeConfidenceDistribution([]);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });
});

describe('computeMostCommonSignals', () => {
  it('counts signal frequency across clips, sorted descending', () => {
    const result = computeMostCommonSignals([['audio', 'scene'], ['audio'], ['facial']]);
    expect(result).toEqual([
      { signal: 'audio', count: 2 },
      { signal: 'scene', count: 1 },
      { signal: 'facial', count: 1 },
    ]);
  });

  it('returns an empty array when no clips have top factors', () => {
    expect(computeMostCommonSignals([])).toEqual([]);
    expect(computeMostCommonSignals([[], []])).toEqual([]);
  });
});

describe('computeGrowthPct', () => {
  it('computes percent change vs the previous period', () => {
    expect(computeGrowthPct(15, 10)).toBe(50);
    expect(computeGrowthPct(5, 10)).toBe(-50);
    expect(computeGrowthPct(10, 10)).toBe(0);
  });

  it('returns null when there is no prior-period data, not a fabricated value', () => {
    expect(computeGrowthPct(10, 0)).toBeNull();
    expect(computeGrowthPct(0, 0)).toBeNull();
  });
});

describe('bucketByPublishDate', () => {
  const now = new Date('2026-01-10T12:00:00.000Z');

  it('zero-fills every day with no publishes', () => {
    const result = bucketByPublishDate([], 3, now);
    expect(result).toEqual([
      { date: '2026-01-08', totalViews: 0, averageEngagementScore: null, publishCount: 0 },
      { date: '2026-01-09', totalViews: 0, averageEngagementScore: null, publishCount: 0 },
      { date: '2026-01-10', totalViews: 0, averageEngagementScore: null, publishCount: 0 },
    ]);
  });

  it('aggregates publishCount/totalViews/averageEngagementScore per day', () => {
    const result = bucketByPublishDate(
      [
        { publishedAt: new Date('2026-01-09T01:00:00.000Z'), viewCount: 100, engagementScore: 0.2 },
        { publishedAt: new Date('2026-01-09T05:00:00.000Z'), viewCount: 50, engagementScore: 0.4 },
        { publishedAt: new Date('2026-01-10T00:00:00.000Z'), viewCount: 10, engagementScore: null },
      ],
      3,
      now,
    );
    const jan9 = result.find((r) => r.date === '2026-01-09')!;
    expect(jan9.publishCount).toBe(2);
    expect(jan9.totalViews).toBe(150);
    expect(jan9.averageEngagementScore).toBeCloseTo(0.3);

    const jan10 = result.find((r) => r.date === '2026-01-10')!;
    expect(jan10.publishCount).toBe(1);
    expect(jan10.totalViews).toBe(10);
    // Only null engagementScore that day -> no data to average.
    expect(jan10.averageEngagementScore).toBeNull();
  });

  it('drops records outside the window', () => {
    const result = bucketByPublishDate(
      [{ publishedAt: new Date('2025-01-01'), viewCount: 999, engagementScore: 1 }],
      3,
      now,
    );
    expect(result.reduce((sum, r) => sum + r.publishCount, 0)).toBe(0);
  });

  it('treats a null viewCount as 0, not skipping the record', () => {
    const result = bucketByPublishDate(
      [
        {
          publishedAt: new Date('2026-01-10T00:00:00.000Z'),
          viewCount: null,
          engagementScore: null,
        },
      ],
      3,
      now,
    );
    const jan10 = result.find((r) => r.date === '2026-01-10')!;
    expect(jan10.publishCount).toBe(1);
    expect(jan10.totalViews).toBe(0);
  });
});
