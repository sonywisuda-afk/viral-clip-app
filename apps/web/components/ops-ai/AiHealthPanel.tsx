import type { OpsAiHealthSnapshot } from '@speedora/shared';
import { StatTile } from '@/components/analytics/StatTile';
import { formatConfidence } from '@/lib/explainability';

export interface AiHealthPanelProps {
  health: OpsAiHealthSnapshot;
}

// Milestone 5C.1 - platform-wide AI Health, reusing M5A's StatTile (no new
// visualization technique needed for plain KPI numbers).
export function AiHealthPanel({ health }: AiHealthPanelProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatTile label="Fusion Engine" value={health.engine} />
      <StatTile label="Total Klip Ber-skor" value={String(health.totalClipsWithScore)} />
      <StatTile label="Rata-rata Confidence" value={formatConfidence(health.averageConfidence)} />
      <StatTile
        label="Low Confidence Clips"
        value={String(health.lowConfidenceClips)}
        caption={`< ${health.lowConfidenceThreshold}`}
      />
      <StatTile
        label="High Confidence Clips"
        value={String(health.highConfidenceClips)}
        caption={`>= ${health.highConfidenceThreshold}`}
      />
      <StatTile label="Missing Explainability" value={String(health.missingExplainability)} />
    </div>
  );
}
