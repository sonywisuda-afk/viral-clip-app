import { formatGrowthPct, formatPublishDate, sortByNumericField } from './performance';

describe('sortByNumericField', () => {
  interface Row {
    id: string;
    score: number | null;
  }

  it('sorts descending by the given field', () => {
    const rows: Row[] = [
      { id: 'a', score: 10 },
      { id: 'b', score: 30 },
      { id: 'c', score: 20 },
    ];
    expect(sortByNumericField(rows, 'score', 'desc').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts ascending by the given field', () => {
    const rows: Row[] = [
      { id: 'a', score: 10 },
      { id: 'b', score: 30 },
      { id: 'c', score: 20 },
    ];
    expect(sortByNumericField(rows, 'score', 'asc').map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts nulls last regardless of direction', () => {
    const rows: Row[] = [
      { id: 'a', score: null },
      { id: 'b', score: 5 },
    ];
    expect(sortByNumericField(rows, 'score', 'desc').map((r) => r.id)).toEqual(['b', 'a']);
    expect(sortByNumericField(rows, 'score', 'asc').map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('does not mutate the input array', () => {
    const rows: Row[] = [
      { id: 'a', score: 10 },
      { id: 'b', score: 30 },
    ];
    const original = [...rows];
    sortByNumericField(rows, 'score', 'desc');
    expect(rows).toEqual(original);
  });
});

describe('formatGrowthPct', () => {
  it('formats positive growth with an explicit sign', () => {
    expect(formatGrowthPct(50)).toBe('+50%');
  });

  it('formats negative growth without an extra sign (the number already has one)', () => {
    expect(formatGrowthPct(-20)).toBe('-20%');
  });

  it('formats zero growth without a sign', () => {
    expect(formatGrowthPct(0)).toBe('0%');
  });

  it('returns an honest no-data label for null, not a fabricated 0%', () => {
    expect(formatGrowthPct(null)).toBe('Tidak ada data');
  });
});

describe('formatPublishDate', () => {
  it('formats a full ISO datetime as day + short month + year', () => {
    expect(formatPublishDate('2026-01-08T14:23:00.000Z')).toBe('8 Jan 2026');
  });

  it('returns an em dash for null', () => {
    expect(formatPublishDate(null)).toBe('—');
  });
});
