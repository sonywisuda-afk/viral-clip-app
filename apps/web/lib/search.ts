import type { SearchResultsDto } from '@speedora/shared';

// Sprint 1-2 (Dashboard Redesign) - pure, no-JSX display helpers for the
// search dropdown, same "keep component logic testable without a
// component-testing framework" reasoning as lib/dashboard.ts.

export function totalResultCount(results: SearchResultsDto): number {
  return results.videos.length + results.clips.length + results.transcriptMatches.length;
}

export function hasAnyResults(results: SearchResultsDto): boolean {
  return totalResultCount(results) > 0;
}

// A short snippet centered on the first match of `query` within `text`,
// with an ellipsis on whichever side got cut - so a transcript result reads
// as "…ini adalah hello dunia…" instead of dumping the entire segment.
// Falls back to the full text when the query isn't actually found in it
// (can happen if a transcript segment's own casing/whitespace splits the
// match across the contains() boundary Postgres used).
export function formatTranscriptSnippet(text: string, query: string, contextChars = 40): string {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) return text;

  const index = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (index === -1) return text;

  const start = Math.max(0, index - contextChars);
  const end = Math.min(text.length, index + trimmedQuery.length + contextChars);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

// e.g. 125.4 -> "2:05" - same mm:ss convention as lib/dashboard.ts's
// formatDuration, just without the hour tier (a transcript match's own
// timestamp is always well within a single video's length).
export function formatTranscriptTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
