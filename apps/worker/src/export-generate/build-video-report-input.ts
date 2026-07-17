import type {
  Clip as PrismaClip,
  TranscriptSegment as PrismaTranscriptSegmentRow,
} from '@speedora/database';
import type { BuildVideoReportInput, ReportClipInput, TimelineEvent } from '@speedora/contracts';
import type {
  AudioFeatures,
  ClipScores,
  FacialEmotionFeatures,
  FusionBreakdown,
  FusionExplainability,
  FusionPrediction,
  FusionRecommendation,
  OcrFeatures,
  TranscriptSegment,
} from '@speedora/shared';
import { filterSegmentsForClip } from '@speedora/shared';

// apps/worker's own small, purpose-built adapter - it cannot import
// apps/api's toSharedX() narrowing helpers (apps talk over HTTP only, and
// apps/worker has no HTTP dependency on apps/api at all), so it narrows
// only the ~10 fields packages/report-builder's contract actually needs,
// directly off raw Prisma rows. This is the second of two independent
// adapters into the same shared @speedora/report-builder module - see
// ARCHITECTURE.md's JSON-contract pattern and this package's own
// description ("consumed by apps/api's export module and apps/worker's
// export-generate adapter").

function toBreakdown(value: unknown): FusionBreakdown {
  return (value as FusionBreakdown | null) ?? [];
}

function toExplainability(value: unknown): FusionExplainability {
  return (value as FusionExplainability | null) ?? { topFactors: [] };
}

function toPrediction(value: unknown): FusionPrediction | null {
  return (value as FusionPrediction | null) ?? null;
}

function toRecommendation(value: unknown): FusionRecommendation | null {
  return (value as FusionRecommendation | null) ?? null;
}

function toScores(value: unknown): ClipScores | null {
  return (value as ClipScores | null) ?? null;
}

function toFacialFeatures(value: unknown): FacialEmotionFeatures | null {
  return (value as FacialEmotionFeatures | null) ?? null;
}

function toOcrFeatures(value: unknown): OcrFeatures | null {
  return (value as OcrFeatures | null) ?? null;
}

function toAudioFeatures(value: unknown): AudioFeatures | null {
  return (value as AudioFeatures | null) ?? null;
}

function toReportClipInput(clip: PrismaClip, clipSegments: TranscriptSegment[]): ReportClipInput {
  const scores = toScores(clip.scores);
  return {
    id: clip.id,
    startTime: clip.startTime,
    endTime: clip.endTime,
    hookText: clip.hookText,
    thumbnailUrl: clip.thumbnailUrl ? `/clips/${clip.id}/thumbnail` : null,
    keywords: clip.keywords,
    hashtags: clip.hashtags,
    topics: clip.topics,
    intent: clip.intent,
    ctaText: clip.ctaText,
    ctaStrength: scores?.ctaStrength ?? null,
    facialFeatures: toFacialFeatures(clip.facialFeatures),
    ocrFeatures: toOcrFeatures(clip.ocrFeatures),
    audioFeatures: toAudioFeatures(clip.audioFeatures),
    segments: clipSegments.map((segment) => ({ emotion: segment.emotion })),
    highlightScore: clip.highlightScore,
    highlightConfidence: clip.highlightConfidence,
    highlightReason: clip.highlightReason,
    highlightBreakdown: toBreakdown(clip.highlightBreakdown),
    highlightTopFactors: toExplainability(clip.highlightExplainability).topFactors,
    highlightPrediction: toPrediction(clip.highlightPrediction),
    highlightRecommendation: toRecommendation(clip.highlightRecommendation),
    highlightRank: clip.highlightRank,
  };
}

export interface BuildVideoReportInputParams {
  video: { title: string | null; thumbnailUrl: string | null; durationSeconds: number | null };
  clips: PrismaClip[];
  segments: Pick<PrismaTranscriptSegmentRow, 'start' | 'end' | 'text' | 'speaker' | 'emotion'>[];
  statusEvents: TimelineEvent[];
}

export function buildVideoReportInputFromPrisma(
  params: BuildVideoReportInputParams,
): BuildVideoReportInput {
  const segments: TranscriptSegment[] = params.segments.map((segment) => ({
    start: segment.start,
    end: segment.end,
    text: segment.text,
    speaker: segment.speaker ?? undefined,
    emotion: segment.emotion ?? undefined,
  }));

  return {
    video: {
      title: params.video.title,
      thumbnailUrl: params.video.thumbnailUrl,
      durationSeconds: params.video.durationSeconds,
    },
    clips: params.clips.map((clip) =>
      toReportClipInput(clip, filterSegmentsForClip(segments, clip.startTime, clip.endTime)),
    ),
    statusEvents: params.statusEvents,
  };
}
