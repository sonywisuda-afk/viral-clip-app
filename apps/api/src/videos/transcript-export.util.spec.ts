import { buildSrtCaptions, buildTranscriptTxt, buildVttCaptions } from './transcript-export.util';

const segments = [
  { start: 0, end: 2.5, text: 'Hello and welcome.' },
  { start: 2.5, end: 5.125, text: 'Let’s get started.' },
];

describe('buildTranscriptTxt', () => {
  it('joins segment text one line per segment', () => {
    expect(buildTranscriptTxt(segments)).toBe('Hello and welcome.\nLet’s get started.\n');
  });

  it('skips blank/whitespace-only segments', () => {
    expect(buildTranscriptTxt([...segments, { start: 5.125, end: 6, text: '   ' }])).toBe(
      'Hello and welcome.\nLet’s get started.\n',
    );
  });

  it('returns just a trailing newline for an empty transcript', () => {
    expect(buildTranscriptTxt([])).toBe('\n');
  });
});

describe('buildSrtCaptions', () => {
  it('numbers cues from 1 and formats HH:MM:SS,mmm with a comma separator', () => {
    const srt = buildSrtCaptions(segments);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello and welcome.\n');
    expect(srt).toContain('2\n00:00:02,500 --> 00:00:05,125\nLet’s get started.\n');
  });

  it('zero-pads hours (unlike ASS timestamps)', () => {
    const srt = buildSrtCaptions([{ start: 3661, end: 3663, text: 'An hour in.' }]);
    expect(srt).toContain('01:01:01,000 --> 01:01:03,000');
  });
});

describe('buildVttCaptions', () => {
  it('starts with the WEBVTT header', () => {
    expect(buildVttCaptions(segments).startsWith('WEBVTT\n\n')).toBe(true);
  });

  it('formats HH:MM:SS.mmm with a period separator', () => {
    const vtt = buildVttCaptions(segments);
    expect(vtt).toContain('1\n00:00:00.000 --> 00:00:02.500\nHello and welcome.\n');
  });
});
