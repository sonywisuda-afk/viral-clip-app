import type {
  BuildVideoReportInput,
  ReportClipInput,
  TimelineEvent,
  VideoReportData,
} from '@speedora/contracts';
import { filterSegmentsForClip, type Clip, type TranscriptSegment } from '@speedora/shared';
import { toCsvRow } from '../common/csv.util';

// Only what this file's functions actually read off a Clip DTO - VideosService.
// mapVideoWithClips's inferred return type never got captionStyle narrowed to
// the shared CaptionStyle union (a pre-existing, harmless gap - nothing else
// reads that field off it), which makes the FULL Clip type not quite
// assignable from it. Narrowing the parameter to just these fields sidesteps
// that mismatch and, per this codebase's own "a module's input contract
// should only demand what it actually uses" convention, is the more correct
// shape anyway.
export type ReportSourceClip = Pick<
  Clip,
  | 'id'
  | 'startTime'
  | 'endTime'
  | 'hookText'
  | 'thumbnailUrl'
  | 'keywords'
  | 'hashtags'
  | 'topics'
  | 'intent'
  | 'ctaText'
  | 'scores'
  | 'facialFeatures'
  | 'ocrFeatures'
  | 'audioFeatures'
  | 'highlightScore'
  | 'highlightConfidence'
  | 'highlightReason'
  | 'highlightBreakdown'
  | 'highlightExplainability'
  | 'highlightPrediction'
  | 'highlightRecommendation'
  | 'highlightRank'
>;

const NA = 'n/a';

function orNa(value: string | number | null): string | number {
  return value ?? NA;
}

// Narrows one Clip DTO (already fully explainability-narrowed by
// VideosService.mapVideoWithClips - see this codebase's own comment there)
// plus its own clip-scoped segments (already filtered by the caller via
// @speedora/shared's filterSegmentsForClip) into report-builder's input
// shape. ctaText/ctaStrength are a straight read of already-computed
// detect-clips LLM output, never re-derived (see packages/contracts'
// export-center.ts comment on the same point).
export function toReportClipInput(
  clip: ReportSourceClip,
  clipSegments: TranscriptSegment[],
): ReportClipInput {
  return {
    id: clip.id,
    startTime: clip.startTime,
    endTime: clip.endTime,
    hookText: clip.hookText,
    thumbnailUrl: clip.thumbnailUrl,
    keywords: clip.keywords,
    hashtags: clip.hashtags,
    topics: clip.topics,
    intent: clip.intent,
    ctaText: clip.ctaText,
    ctaStrength: clip.scores?.ctaStrength ?? null,
    facialFeatures: clip.facialFeatures,
    ocrFeatures: clip.ocrFeatures,
    audioFeatures: clip.audioFeatures,
    segments: clipSegments.map((segment) => ({ emotion: segment.emotion })),
    highlightScore: clip.highlightScore,
    highlightConfidence: clip.highlightConfidence,
    highlightReason: clip.highlightReason,
    highlightBreakdown: clip.highlightBreakdown,
    highlightTopFactors: clip.highlightExplainability.topFactors,
    highlightPrediction: clip.highlightPrediction,
    highlightRecommendation: clip.highlightRecommendation,
    highlightRank: clip.highlightRank,
  };
}

export function buildVideoReportInput(
  video: {
    title: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    clips: ReportSourceClip[];
  },
  allSegments: TranscriptSegment[],
  statusEvents: TimelineEvent[],
): BuildVideoReportInput {
  return {
    video: {
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
    },
    clips: video.clips.map((clip) =>
      toReportClipInput(clip, filterSegmentsForClip(allSegments, clip.startTime, clip.endTime)),
    ),
    statusEvents,
  };
}

// Deliberately a flatter view than the JSON report: cover/summary/timeline/
// highlight(score+reason+rank)/topMoments/keyword/cta/thumbnail only - the
// deeply nested per-signal detail (breakdown, face/speech/OCR analysis)
// stays JSON-only, same "CSV is the simple summary, JSON is the full dump"
// posture as dashboard-export.util.ts's own CSV.
export function buildVideoReportCsv(report: VideoReportData): string {
  const lines: string[] = ['Section,ClipId,Field,Value'];

  lines.push(toCsvRow(['Cover', '', 'Video Title', orNa(report.cover.videoTitle)]));
  lines.push(toCsvRow(['Cover', '', 'Thumbnail URL', orNa(report.cover.thumbnailUrl)]));

  lines.push(
    toCsvRow([
      'Video Summary',
      '',
      'Duration (seconds)',
      orNa(report.videoSummary.durationSeconds),
    ]),
  );
  lines.push(toCsvRow(['Video Summary', '', 'Clip Count', report.videoSummary.clipCount]));
  lines.push(
    toCsvRow([
      'Video Summary',
      '',
      'Average Highlight Score',
      orNa(report.videoSummary.averageHighlightScore),
    ]),
  );

  for (const event of report.timeline.events) {
    const value = event.errorMessage ? `${event.toStatus} - ${event.errorMessage}` : event.toStatus;
    lines.push(toCsvRow(['Timeline', '', event.occurredAt, value]));
  }

  for (const entry of report.highlight.entries) {
    lines.push(toCsvRow(['Highlight', entry.clipId, 'Score', orNa(entry.highlightScore)]));
    lines.push(
      toCsvRow(['Highlight', entry.clipId, 'Confidence', orNa(entry.highlightConfidence)]),
    );
    lines.push(toCsvRow(['Highlight', entry.clipId, 'Reason', orNa(entry.highlightReason)]));
    lines.push(toCsvRow(['Highlight', entry.clipId, 'Rank', orNa(entry.highlightRank)]));
  }

  for (const moment of report.topMoments.moments) {
    lines.push(toCsvRow(['Top Moments', moment.clipId, 'Hook', orNa(moment.hookText)]));
  }

  for (const entry of report.keyword.entries) {
    lines.push(toCsvRow(['Keyword', entry.clipId, 'Keywords', entry.keywords.join('; ') || NA]));
    lines.push(toCsvRow(['Keyword', entry.clipId, 'Hashtags', entry.hashtags.join('; ') || NA]));
    lines.push(toCsvRow(['Keyword', entry.clipId, 'Topics', entry.topics.join('; ') || NA]));
  }

  for (const entry of report.cta.entries) {
    lines.push(toCsvRow(['CTA', entry.clipId, 'Text', orNa(entry.ctaText)]));
    lines.push(toCsvRow(['CTA', entry.clipId, 'Strength', orNa(entry.ctaStrength)]));
  }

  for (const entry of report.thumbnail.entries) {
    lines.push(toCsvRow(['Thumbnail', entry.clipId, 'Thumbnail URL', orNa(entry.thumbnailUrl)]));
  }

  return lines.join('\n') + '\n';
}
