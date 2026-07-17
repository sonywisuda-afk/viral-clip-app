import type { BuildVideoReportInput } from '@speedora/contracts';
import { buildVideoReportData } from './build-video-report';

function baseInput(overrides: Partial<BuildVideoReportInput> = {}): BuildVideoReportInput {
  return {
    video: {
      title: 'How I 10x-ed my morning routine',
      thumbnailUrl: '/videos/v1/thumbnail',
      durationSeconds: 600,
    },
    clips: [
      {
        id: 'clip-1',
        startTime: 0,
        endTime: 30,
        hookText: 'You will not believe this',
        thumbnailUrl: '/clips/clip-1/thumbnail',
        keywords: ['focus'],
        hashtags: ['productivity'],
        topics: ['self-improvement'],
        intent: 'educate',
        ctaText: 'Subscribe for more',
        ctaStrength: 65,
        facialFeatures: null,
        ocrFeatures: null,
        audioFeatures: null,
        segments: [{ emotion: 'hap' }],
        highlightScore: 72,
        highlightConfidence: 0.6,
        highlightReason: 'Strong hook and clear CTA',
        highlightBreakdown: [],
        highlightTopFactors: [],
        highlightPrediction: null,
        highlightRecommendation: null,
        highlightRank: 1,
      },
    ],
    statusEvents: [
      { toStatus: 'RENDERED', occurredAt: '2026-07-17T03:00:00.000Z', errorMessage: null },
    ],
    ...overrides,
  };
}

describe('buildVideoReportData', () => {
  it('assembles all 11 sections from one input', () => {
    const result = buildVideoReportData(baseInput());

    expect(Object.keys(result).sort()).toEqual(
      [
        'cover',
        'videoSummary',
        'timeline',
        'highlight',
        'topMoments',
        'faceAnalysis',
        'speechAnalysis',
        'ocrSummary',
        'keyword',
        'cta',
        'thumbnail',
      ].sort(),
    );
    expect(result.cover.videoTitle).toBe('How I 10x-ed my morning routine');
    expect(result.videoSummary).toEqual({
      durationSeconds: 600,
      clipCount: 1,
      averageHighlightScore: 72,
    });
    expect(result.timeline.events).toHaveLength(1);
    expect(result.highlight.entries[0].clipId).toBe('clip-1');
    expect(result.topMoments.moments[0].clipId).toBe('clip-1');
    expect(result.keyword.entries[0].keywords).toEqual(['focus']);
    expect(result.cta.entries[0].ctaText).toBe('Subscribe for more');
    expect(result.thumbnail.entries[0].thumbnailUrl).toBe('/clips/clip-1/thumbnail');
  });

  it('defaults statusEvents to an empty timeline when omitted', () => {
    const input = baseInput();
    delete (input as { statusEvents?: unknown }).statusEvents;
    expect(buildVideoReportData(input).timeline.events).toEqual([]);
  });

  it('produces empty sections for a video with zero clips', () => {
    const result = buildVideoReportData(baseInput({ clips: [] }));
    expect(result.videoSummary).toEqual({
      durationSeconds: 600,
      clipCount: 0,
      averageHighlightScore: null,
    });
    expect(result.highlight.entries).toEqual([]);
    expect(result.topMoments.moments).toEqual([]);
  });
});
