import type { ExplainabilityReasonEntry } from '@speedora/shared';
import { formatPct } from '@/lib/ops-ai';

export interface ExplainabilityReasonsListProps {
  reasons: ExplainabilityReasonEntry[];
}

// Milestone 5C.5 - aggregated topFactors[].description frequency (e.g.
// "High Emotion" x 42, 18%). Easier to scan than a raw per-clip reason list.
export function ExplainabilityReasonsList({ reasons }: ExplainabilityReasonsListProps) {
  if (reasons.length === 0) {
    return <p className="font-body text-sm text-muted-foreground">Belum ada data explainability.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {reasons.slice(0, 10).map((entry) => (
        <li key={entry.description} className="flex items-center justify-between gap-2 font-body text-sm">
          <span className="text-foreground">{entry.description}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {entry.count}x &middot; {formatPct(entry.pct)}
          </span>
        </li>
      ))}
    </ul>
  );
}
