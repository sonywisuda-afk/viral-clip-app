import type { AnalyticsOverviewDto, AnalyticsPerformanceDto } from '@speedora/shared';
import { toCsvRow } from '../common/csv.util';

// Sprint 1-2 (Dashboard Redesign) - the Export Report quick action. Reuses
// AnalyticsService's already-computed Overview + 30-day Performance data
// rather than a new data pipeline - see DashboardService.exportCsv.
export function buildDashboardReportCsv(
  overview: AnalyticsOverviewDto,
  performance: AnalyticsPerformanceDto,
): string {
  const lines: string[] = ['Section,Metric,Value'];

  lines.push(toCsvRow(['Overview', 'Total Videos', overview.totalVideos]));
  lines.push(toCsvRow(['Overview', 'Total Clips', overview.totalClips]));
  lines.push(toCsvRow(['Overview', 'Published Clips', overview.publishedClips]));
  lines.push(
    toCsvRow(['Overview', 'Average Engagement Score', overview.averageEngagementScore ?? 'n/a']),
  );

  for (const platform of overview.platformBreakdown) {
    lines.push(toCsvRow(['Platform Breakdown', platform.platform, platform.publishedCount]));
  }

  lines.push(
    toCsvRow([
      'Performance (last 30 days)',
      'Average Highlight Score',
      performance.aiSummary.averageHighlightScore ?? 'n/a',
    ]),
  );
  lines.push(
    toCsvRow([
      'Performance (last 30 days)',
      'Average Confidence',
      performance.aiSummary.averageConfidence ?? 'n/a',
    ]),
  );

  for (const row of performance.platformComparison) {
    lines.push(
      toCsvRow([
        'Platform Performance (last 30 days)',
        row.platform,
        `${row.publishCount} published, avg engagement ${row.averageEngagementScore ?? 'n/a'}`,
      ]),
    );
  }

  return lines.join('\n') + '\n';
}
