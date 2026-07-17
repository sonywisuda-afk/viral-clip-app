import type { ClipMetadataInput, ClipMetadataOutput } from '@speedora/contracts';
import type { Clip } from '@speedora/shared';
import { toCsvRow } from '../common/csv.util';

const NA = 'n/a';

function orNa(value: string | number | null): string | number {
  return value ?? NA;
}

// Same "narrow to just what's read" reasoning as video-report.util.ts's
// ReportSourceClip - sidesteps mapVideoWithClips's inferred captionStyle
// mismatch against the full Clip type.
type MetadataSourceClip = Pick<
  Clip,
  | 'id'
  | 'startTime'
  | 'endTime'
  | 'hookText'
  | 'hashtags'
  | 'keywords'
  | 'topics'
  | 'intent'
  | 'ctaText'
  | 'highlightScore'
  | 'highlightRank'
  | 'scores'
>;

// ClipScores is a fixed-field interface (hookStrength/educationalValue/...),
// not an index-signature type - the cast is safe because every one of its
// fields is a number, and clipMetadataInputSchema.parse() (inside
// buildClipMetadataReport) validates the actual shape at runtime.
export function toClipMetadataInput(clips: MetadataSourceClip[]): ClipMetadataInput {
  return {
    clips: clips.map((clip) => ({
      id: clip.id,
      startTime: clip.startTime,
      endTime: clip.endTime,
      hookText: clip.hookText,
      hashtags: clip.hashtags,
      keywords: clip.keywords,
      topics: clip.topics,
      intent: clip.intent,
      ctaText: clip.ctaText,
      highlightScore: clip.highlightScore,
      highlightRank: clip.highlightRank,
      scores: clip.scores ? ({ ...clip.scores } as unknown as Record<string, number>) : null,
    })),
  };
}

export function buildClipMetadataCsv(output: ClipMetadataOutput): string {
  const lines: string[] = [
    'ClipId,StartTime,EndTime,Hook,Hashtags,Keywords,Topics,Intent,CtaText,HighlightScore,HighlightRank',
  ];

  for (const clip of output.clips) {
    lines.push(
      toCsvRow([
        clip.clipId,
        clip.startTime,
        clip.endTime,
        orNa(clip.hookText),
        clip.hashtags.join('; ') || NA,
        clip.keywords.join('; ') || NA,
        clip.topics.join('; ') || NA,
        orNa(clip.intent),
        orNa(clip.ctaText),
        orNa(clip.highlightScore),
        orNa(clip.highlightRank),
      ]),
    );
  }

  return lines.join('\n') + '\n';
}
