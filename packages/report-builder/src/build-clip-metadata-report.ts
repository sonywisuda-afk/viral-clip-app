import {
  clipMetadataInputSchema,
  clipMetadataOutputSchema,
  type ClipMetadataInput,
  type ClipMetadataOutput,
} from '@speedora/contracts';

// The Clip Metadata export format - field selection only, no section
// shaping (unlike buildVideoReportData), since it's consumed as one flat
// row per clip (CSV/JSON), not a multi-section document.
export function buildClipMetadataReport(input: ClipMetadataInput): ClipMetadataOutput {
  const { clips } = clipMetadataInputSchema.parse(input);

  return clipMetadataOutputSchema.parse({
    clips: clips.map((clip) => ({
      clipId: clip.id,
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
      scores: clip.scores,
    })),
  });
}
