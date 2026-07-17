import type { BuildVideoReportInput, ReportClipInput } from '@speedora/contracts';
import {
  buildCoverSection,
  buildThumbnailSection,
  buildTimelineSection,
  buildVideoSummarySection,
} from './structural';

function baseVideo(
  overrides: Partial<BuildVideoReportInput['video']> = {},
): BuildVideoReportInput['video'] {
  return {
    title: 'How I 10x-ed my morning routine',
    thumbnailUrl: '/videos/v1/thumbnail',
    durationSeconds: 600,
    ...overrides,
  };
}

function baseClip(overrides: Partial<ReportClipInput> = {}): ReportClipInput {
  return {
    id: 'clip-1',
    startTime: 0,
    endTime: 30,
    hookText: 'You will not believe this',
    thumbnailUrl: '/clips/clip-1/thumbnail',
    keywords: [],
    hashtags: [],
    topics: [],
    intent: null,
    ctaText: null,
    ctaStrength: null,
    facialFeatures: null,
    ocrFeatures: null,
    audioFeatures: null,
    segments: [],
    highlightScore: null,
    highlightConfidence: null,
    highlightReason: null,
    highlightBreakdown: [],
    highlightTopFactors: [],
    highlightPrediction: null,
    highlightRecommendation: null,
    highlightRank: null,
    ...overrides,
  };
}

describe('buildCoverSection', () => {
  it('carries the video title and thumbnail straight through', () => {
    expect(buildCoverSection(baseVideo())).toEqual({
      videoTitle: 'How I 10x-ed my morning routine',
      thumbnailUrl: '/videos/v1/thumbnail',
    });
  });

  it('passes through nulls for an untitled/unthumbnailed video', () => {
    expect(buildCoverSection(baseVideo({ title: null, thumbnailUrl: null }))).toEqual({
      videoTitle: null,
      thumbnailUrl: null,
    });
  });
});

describe('buildVideoSummarySection', () => {
  it('averages highlightScore only over clips that have one', () => {
    const clips = [
      baseClip({ id: 'a', highlightScore: 80 }),
      baseClip({ id: 'b', highlightScore: 40 }),
      baseClip({ id: 'c', highlightScore: null }),
    ];
    expect(buildVideoSummarySection(baseVideo(), clips)).toEqual({
      durationSeconds: 600,
      clipCount: 3,
      averageHighlightScore: 60,
    });
  });

  it('reports null average when no clip has a highlightScore', () => {
    const clips = [baseClip({ id: 'a', highlightScore: null })];
    expect(buildVideoSummarySection(baseVideo(), clips).averageHighlightScore).toBeNull();
  });

  it('reports zero clipCount for a video with no clips', () => {
    expect(buildVideoSummarySection(baseVideo(), [])).toEqual({
      durationSeconds: 600,
      clipCount: 0,
      averageHighlightScore: null,
    });
  });
});

describe('buildTimelineSection', () => {
  it('sorts events chronologically regardless of input order', () => {
    const result = buildTimelineSection([
      { toStatus: 'RENDERED', occurredAt: '2026-07-17T03:00:00.000Z', errorMessage: null },
      { toStatus: 'UPLOADED', occurredAt: '2026-07-17T01:00:00.000Z', errorMessage: null },
      { toStatus: 'TRANSCRIBED', occurredAt: '2026-07-17T02:00:00.000Z', errorMessage: null },
    ]);
    expect(result.events.map((e) => e.toStatus)).toEqual(['UPLOADED', 'TRANSCRIBED', 'RENDERED']);
  });

  it('returns an empty events list for a video with no recorded events', () => {
    expect(buildTimelineSection([])).toEqual({ events: [] });
  });
});

describe('buildThumbnailSection', () => {
  it('lists one entry per clip', () => {
    const clips = [
      baseClip({ id: 'a', thumbnailUrl: '/clips/a/thumbnail' }),
      baseClip({ id: 'b', thumbnailUrl: null }),
    ];
    expect(buildThumbnailSection(clips)).toEqual({
      entries: [
        { clipId: 'a', thumbnailUrl: '/clips/a/thumbnail' },
        { clipId: 'b', thumbnailUrl: null },
      ],
    });
  });
});
