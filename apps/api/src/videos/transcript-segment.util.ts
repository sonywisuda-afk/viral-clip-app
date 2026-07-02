import type {
  CaptionStyle as PrismaCaptionStyle,
  TranscriptSegment as TranscriptSegmentRow,
} from '@viral-clip-app/database';
import type { CaptionStyle, TranscriptSegment, TranscriptWord } from '@viral-clip-app/shared';

// Prisma types a Json column as the opaque JsonValue union - this narrows it
// back to the shape transcribe.worker.ts actually writes there. Used
// wherever a TranscriptSegment row read from Postgres needs to become the
// packages/shared-typed shape a job payload expects (VideosService.retry,
// ClipsService.render).
export function toSharedTranscriptSegment(segment: TranscriptSegmentRow): TranscriptSegment {
  return {
    start: segment.start,
    end: segment.end,
    text: segment.text,
    speaker: segment.speaker ?? undefined,
    words: Array.isArray(segment.words)
      ? (segment.words as unknown as TranscriptWord[])
      : undefined,
  };
}

// Prisma's generated CaptionStyle enum and packages/shared's are two
// separately-declared TS enums with identical string members (see
// CLAUDE.md's "Mirrors X" convention, also used for VideoStatus) - which
// makes them structurally identical at runtime but nominally distinct
// types, so passing one where the other is expected needs this explicit
// (safe) cast rather than a silent compile error.
export function toSharedCaptionStyle(style: PrismaCaptionStyle): CaptionStyle {
  return style as unknown as CaptionStyle;
}
