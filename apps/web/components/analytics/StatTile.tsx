import { Card, CardContent } from '@/components/ui/card';

export interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
}

// A single KPI number - deliberately plain, not a gauge/bar. Per the
// dataviz skill's form heuristic: a single number's job is a headline, not
// a chart.
export function StatTile({ label, value, caption }: StatTileProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-display text-3xl text-foreground">{value}</p>
        {caption ? (
          <p className="mt-1 font-body text-xs text-muted-foreground">{caption}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
