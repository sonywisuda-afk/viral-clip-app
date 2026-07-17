// Only what these three export formats actually read from a transcript
// segment - narrower than the full TranscriptSegment/VideosService.
// findTranscriptOrThrow shape (drops speaker/emotion, neither format needs
// them), same "input contract only demands what's used" posture as every
// stateless module in this codebase.
export interface ExportableSegment {
  start: number;
  end: number;
  text: string;
}

function pad(value: number, width = 2): string {
  return value.toString().padStart(width, '0');
}

// SRT's HH:MM:SS,mmm - always 2-digit hours (unlike @speedora/subtitles'
// ASS-specific toAssTimestamp, which allows single-digit hours and uses
// centiseconds) and a comma millisecond separator.
function toSrtTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const milliseconds = Math.round((clamped % 1) * 1000);
  const totalSeconds = Math.floor(clamped);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milliseconds, 3)}`;
}

// WebVTT's HH:MM:SS.mmm - same width/precision as SRT, period separator.
function toVttTimestamp(seconds: number): string {
  return toSrtTimestamp(seconds).replace(',', '.');
}

export function buildTranscriptTxt(segments: ExportableSegment[]): string {
  return (
    segments
      .map((segment) => segment.text.trim())
      .filter((text) => text.length > 0)
      .join('\n') + '\n'
  );
}

export function buildSrtCaptions(segments: ExportableSegment[]): string {
  return (
    segments
      .map(
        (segment, index) =>
          `${index + 1}\n${toSrtTimestamp(segment.start)} --> ${toSrtTimestamp(segment.end)}\n${segment.text.trim()}\n`,
      )
      .join('\n') + '\n'
  );
}

export function buildVttCaptions(segments: ExportableSegment[]): string {
  const cues = segments
    .map(
      (segment, index) =>
        `${index + 1}\n${toVttTimestamp(segment.start)} --> ${toVttTimestamp(segment.end)}\n${segment.text.trim()}\n`,
    )
    .join('\n');
  return `WEBVTT\n\n${cues}\n`;
}
