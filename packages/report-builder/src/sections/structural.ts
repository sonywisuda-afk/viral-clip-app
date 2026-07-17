import type {
  BuildVideoReportInput,
  CoverSection,
  ReportClipInput,
  ThumbnailSection,
  TimelineEvent,
  TimelineSection,
  VideoSummarySection,
} from '@speedora/contracts';

export function buildCoverSection(video: BuildVideoReportInput['video']): CoverSection {
  return {
    videoTitle: video.title,
    thumbnailUrl: video.thumbnailUrl,
  };
}

// Mean highlight score is over clips that actually have one (a clip whose
// weighted Fusion Engine contributions summed to zero is null, not a
// fabricated 0 - see video.ts's own comment on Clip.highlightScore) -
// averaging in nulls as zero would understate every video with any
// not-yet-scored clips.
export function buildVideoSummarySection(
  video: BuildVideoReportInput['video'],
  clips: ReportClipInput[],
): VideoSummarySection {
  const scored = clips.filter(
    (clip): clip is ReportClipInput & { highlightScore: number } => clip.highlightScore !== null,
  );
  const averageHighlightScore =
    scored.length === 0
      ? null
      : scored.reduce((sum, clip) => sum + clip.highlightScore, 0) / scored.length;

  return {
    durationSeconds: video.durationSeconds,
    clipCount: clips.length,
    averageHighlightScore,
  };
}

export function buildTimelineSection(statusEvents: TimelineEvent[]): TimelineSection {
  return {
    events: [...statusEvents].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
  };
}

export function buildThumbnailSection(clips: ReportClipInput[]): ThumbnailSection {
  return {
    entries: clips.map((clip) => ({ clipId: clip.id, thumbnailUrl: clip.thumbnailUrl })),
  };
}
