import type { FeatureDistributionRow } from '@speedora/shared';

export interface FeatureDistributionTableProps {
  rows: FeatureDistributionRow[];
}

// Milestone 1.5's Feature Distribution, surfaced in UI for the first time.
// Every Fusion Engine signal feature should sit in [0, 1] - a feature whose
// observed min/max violates that is a real normalization bug, not noise.
export function FeatureDistributionTable({ rows }: FeatureDistributionTableProps) {
  if (rows.length === 0) {
    return (
      <p className="font-body text-sm text-muted-foreground">Belum ada nilai fitur numerik.</p>
    );
  }

  return (
    <div className="max-h-96 overflow-x-auto overflow-y-auto">
      <table className="w-full border-collapse font-body text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Feature
            </th>
            <th className="p-2 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Count
            </th>
            <th className="p-2 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Min
            </th>
            <th className="p-2 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Max
            </th>
            <th className="p-2 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Mean
            </th>
            <th className="p-2 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Stddev
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-border/50">
              <td className="p-2 font-mono text-xs text-foreground">{row.feature}</td>
              <td className="p-2 text-right font-mono text-xs text-muted-foreground">
                {row.count}
              </td>
              <td className="p-2 text-right font-mono text-xs text-muted-foreground">
                {row.min.toFixed(3)}
              </td>
              <td className="p-2 text-right font-mono text-xs text-muted-foreground">
                {row.max.toFixed(3)}
              </td>
              <td className="p-2 text-right font-mono text-xs text-muted-foreground">
                {row.mean.toFixed(3)}
              </td>
              <td className="p-2 text-right font-mono text-xs text-muted-foreground">
                {row.stddev.toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
