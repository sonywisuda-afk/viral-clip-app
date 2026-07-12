import type { DashboardStatsDto } from '@speedora/shared';
import { StatTile } from '@/components/analytics/StatTile';
import { formatBytes, formatDuration } from '@/lib/dashboard';

export interface StatisticsRowProps {
  stats: DashboardStatsDto;
}

// Six StatTiles (reused as-is from the Analytics Dashboard - Milestone 5A)
// fed by GET /dashboard/stats. Deliberately plain numbers, not gauges/bars -
// per the dataviz skill's form heuristic, a KPI's job is a headline.
export function StatisticsRow({ stats }: StatisticsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="Total Video" value={String(stats.totalVideos)} />
      <StatTile label="Total Klip" value={String(stats.totalClips)} />
      <StatTile
        label="Waktu Proses"
        value={formatDuration(stats.avgProcessingTimeSeconds)}
        caption="Rata-rata"
      />
      <StatTile label="Storage Terpakai" value={formatBytes(stats.storageUsedBytes)} />
      <StatTile
        label="Penggunaan Bulan Ini"
        value={`${stats.monthlyVideos} video`}
        caption={`${stats.monthlyClips} klip`}
      />
      <StatTile
        label="Kredit Premium"
        value={String(stats.premiumCreditsThisMonth)}
        caption="Bulan ini"
      />
    </div>
  );
}
