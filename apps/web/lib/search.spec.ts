import type { SearchResultsDto } from '@speedora/shared';
import {
  formatTranscriptSnippet,
  formatTranscriptTimestamp,
  hasAnyResults,
  totalResultCount,
} from './search';

const empty: SearchResultsDto = { videos: [], clips: [], transcriptMatches: [] };

describe('totalResultCount / hasAnyResults', () => {
  it('counts across all three categories', () => {
    const results: SearchResultsDto = {
      videos: [{ videoId: 'v1', title: 'a', createdAt: '2026-01-01' }],
      clips: [{ clipId: 'c1', videoId: 'v1', hookText: null, hashtags: [] }],
      transcriptMatches: [{ videoId: 'v1', start: 0, end: 1, text: 'hi' }],
    };

    expect(totalResultCount(results)).toBe(3);
    expect(hasAnyResults(results)).toBe(true);
  });

  it('returns 0/false for an empty result set', () => {
    expect(totalResultCount(empty)).toBe(0);
    expect(hasAnyResults(empty)).toBe(false);
  });
});

describe('formatTranscriptSnippet', () => {
  it('returns the full text unchanged when it already fits within the context window', () => {
    expect(formatTranscriptSnippet('hello world', 'hello')).toBe('hello world');
  });

  it('truncates with a leading ellipsis when the match is far from the start', () => {
    const text = 'x'.repeat(60) + 'hello' + 'y'.repeat(10);
    const snippet = formatTranscriptSnippet(text, 'hello', 10);

    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet).toContain('hello');
  });

  it('truncates with a trailing ellipsis when there is more text after the context window', () => {
    const text = 'hello' + 'y'.repeat(60);
    const snippet = formatTranscriptSnippet(text, 'hello', 10);

    expect(snippet.endsWith('…')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(formatTranscriptSnippet('Hello World', 'hello')).toBe('Hello World');
  });

  it('falls back to the full text when the query is not actually found', () => {
    expect(formatTranscriptSnippet('hello world', 'xyz')).toBe('hello world');
  });

  it('returns the full text when the query is blank', () => {
    expect(formatTranscriptSnippet('hello world', '   ')).toBe('hello world');
  });
});

describe('formatTranscriptTimestamp', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTranscriptTimestamp(65)).toBe('1:05');
    expect(formatTranscriptTimestamp(5)).toBe('0:05');
  });

  it('floors fractional seconds', () => {
    expect(formatTranscriptTimestamp(125.9)).toBe('2:05');
  });
});
