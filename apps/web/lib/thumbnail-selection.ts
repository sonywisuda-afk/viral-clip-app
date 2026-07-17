import type { ThumbnailContribution, ThumbnailFallbackLevel } from '@speedora/shared';

// Phase 4 of the thumbnail roadmap (AI Thumbnail Selection) - pure, no-JSX
// helpers for the ThumbnailSelectionPanel, same "testable without a
// component-testing framework" reasoning as lib/explainability.ts.

export interface FallbackBadge {
  label: string;
  tone: 'good' | 'neutral' | 'bad';
}

// Ordered worst-signal to best-signal, same as
// @speedora/contracts' THUMBNAIL_FALLBACK_LEVELS - 'midpoint' means no timed
// signal contributed at all (today's old behavior, not a real AI choice),
// so it reads as the least confident outcome, not a neutral one.
const FALLBACK_BADGES: Record<ThumbnailFallbackLevel, FallbackBadge> = {
  midpoint: { label: 'Titik Tengah (Tanpa Sinyal)', tone: 'bad' },
  single_signal: { label: 'Satu Sinyal', tone: 'neutral' },
  multi_signal: { label: 'Gabungan Sinyal', tone: 'good' },
};

export function fallbackBadge(level: ThumbnailFallbackLevel): FallbackBadge {
  return FALLBACK_BADGES[level];
}

// Same mm:ss convention as ClipCard's own formatDuration.
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Sorted by |weightedContribution| descending, same convention as
// lib/explainability.ts's sortTopFactors - the signal that actually decided
// the winning timestamp floats to the top, regardless of the array's
// original order.
export function sortThumbnailContributions(
  contributions: ThumbnailContribution[],
): ThumbnailContribution[] {
  return [...contributions].sort(
    (a, b) => Math.abs(b.weightedContribution) - Math.abs(a.weightedContribution),
  );
}
