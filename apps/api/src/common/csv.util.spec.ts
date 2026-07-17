import { csvEscape, toCsvRow, withUtf8Bom } from './csv.util';

describe('csvEscape', () => {
  it('leaves a plain value unquoted', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(42)).toBe('42');
  });

  it('quotes and doubles internal quotes for a value containing a comma, quote, or newline', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('toCsvRow', () => {
  it('joins escaped fields with commas', () => {
    expect(toCsvRow(['a', 'b,c', 3])).toBe('a,"b,c",3');
  });
});

describe('withUtf8Bom', () => {
  it('prepends the UTF-8 BOM character', () => {
    const result = withUtf8Bom('a,b\n');
    expect(result.charCodeAt(0)).toBe(0xfeff);
    expect(result.slice(1)).toBe('a,b\n');
  });

  it('preserves non-ASCII content after the BOM (the whole point of adding it)', () => {
    const result = withUtf8Bom('Judul,Nilai\nBerita Terkini,90\n');
    expect(result.slice(1)).toBe('Judul,Nilai\nBerita Terkini,90\n');
  });
});
