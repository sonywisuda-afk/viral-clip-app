import { MONTH_LABELS } from './analytics';

// Milestone 5B (Analytics Dashboard - Performance) - pure, no-JSX display/
// sort logic, same "keep component logic testable without a
// component-testing framework" reasoning as Milestone 4/5A.

export const DAY_RANGE_OPTIONS: Array<{ value: 7 | 30 | 90; label: string }> = [
  { value: 7, label: '7 Hari' },
  { value: 30, label: '30 Hari' },
  { value: 90, label: '90 Hari' },
];

export type SortDirection = 'asc' | 'desc';

// Generic, null-safe numeric sort for the two performance tables
// (TopClipsTable/TopVideosTable) - client-side re-sort on column click
// (design decision #2: no server round-trip per sort). Nulls always sort
// last regardless of direction, so switching direction never buries real
// data under "no data yet" rows.
export function sortByNumericField<T>(rows: T[], key: keyof T, direction: SortDirection): T[] {
  return [...rows].sort((a, b) => {
    const aValue = a[key] as unknown as number | null;
    const bValue = b[key] as unknown as number | null;
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return direction === 'asc' ? aValue - bValue : bValue - aValue;
  });
}

// growthPct is a signed percent (e.g. 50, -20) or null when there's no
// prior-period baseline to compare against - formatted with an explicit
// sign for positive growth and an honest "no data" label for null, never a
// fabricated 0%.
export function formatGrowthPct(growthPct: number | null): string {
  if (growthPct === null) return 'Tidak ada data';
  const sign = growthPct > 0 ? '+' : '';
  return `${sign}${growthPct}%`;
}

// publishedAt is a full ISO datetime (unlike lib/analytics.ts's
// formatShortDate, which expects a bare YYYY-MM-DD date key) - uses a real
// Date object rather than string-splitting, which would break on the time
// component.
export function formatPublishDate(isoDateTime: string | null): string {
  if (isoDateTime === null) return '—';
  const date = new Date(isoDateTime);
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
