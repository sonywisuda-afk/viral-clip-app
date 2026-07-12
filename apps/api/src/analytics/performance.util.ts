import type { EngagementTrendPoint } from '@speedora/shared';

// Milestone 5B (Analytics Dashboard - Performance) - pure aggregation
// helpers, no Prisma access here, same module/adapter split as
// analytics.util.ts.

const CONFIDENCE_BUCKET_LABELS = ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'];

// 5 fixed-width buckets over [0, 1]. Clamped defensively (same posture as
// analytics.util.ts/lib/explainability.ts's other [0,1] clamps) against a
// confidence value outside its documented range.
export function computeConfidenceDistribution(
  confidences: number[],
): Array<{ bucket: string; count: number }> {
  const counts = new Array(CONFIDENCE_BUCKET_LABELS.length).fill(0) as number[];
  for (const confidence of confidences) {
    const clamped = Math.min(1, Math.max(0, confidence));
    const index = clamped === 1 ? counts.length - 1 : Math.floor(clamped * counts.length);
    counts[index] += 1;
  }
  return CONFIDENCE_BUCKET_LABELS.map((bucket, i) => ({ bucket, count: counts[i] }));
}

// Real frequency count - across a window's clips, how often each signal
// appears in that clip's highlightExplainability.topFactors. Descending, so
// the most-influential signals float to the top.
export function computeMostCommonSignals(
  topFactorsPerClip: string[][],
): Array<{ signal: string; count: number }> {
  const counts = new Map<string, number>();
  for (const signals of topFactorsPerClip) {
    for (const signal of signals) {
      counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([signal, count]) => ({ signal, count }))
    .sort((a, b) => b.count - a.count);
}

// Percent change vs. the immediately preceding period of equal length.
// Null (not a fabricated 0%/±Infinity%) when there's no prior-period data
// to compare against - "no baseline" is not "no growth."
export function computeGrowthPct(currentCount: number, previousCount: number): number | null {
  if (previousCount === 0) return null;
  return Math.round(((currentCount - previousCount) / previousCount) * 1000) / 10;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Zero-filled, same convention as analytics.util.ts's bucketUploadsByDay -
// bucketed by PUBLISH date, not snapshot-capture date, because
// `publishCount` only makes sense as "how many clips went live this day";
// totalViews/averageEngagementScore per day are the latest-known stats for
// whatever was published that day, not a growing view-count-over-time
// series.
export function bucketByPublishDate(
  records: Array<{ publishedAt: Date; viewCount: number | null; engagementScore: number | null }>,
  days: number,
  now: Date = new Date(),
): EngagementTrendPoint[] {
  const buckets = new Map<string, { totalViews: number; engagementScores: number[]; publishCount: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(toDateKey(d), { totalViews: 0, engagementScores: [], publishCount: 0 });
  }

  for (const record of records) {
    const bucket = buckets.get(toDateKey(record.publishedAt));
    if (!bucket) continue;
    bucket.publishCount += 1;
    bucket.totalViews += record.viewCount ?? 0;
    if (record.engagementScore !== null) bucket.engagementScores.push(record.engagementScore);
  }

  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    totalViews: b.totalViews,
    averageEngagementScore:
      b.engagementScores.length === 0
        ? null
        : b.engagementScores.reduce((sum, v) => sum + v, 0) / b.engagementScores.length,
    publishCount: b.publishCount,
  }));
}
