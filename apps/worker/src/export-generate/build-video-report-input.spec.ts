import type { Clip as PrismaClip } from '@speedora/database';
import { buildVideoReportData } from '@speedora/report-builder';
import { buildVideoReportInputFromPrisma } from './build-video-report-input';

function baseClip(overrides: Partial<PrismaClip> = {}): PrismaClip {
  return {
    id: 'clip-1',
    startTime: 0,
    endTime: 30,
    hookText: 'You will not believe this',
    thumbnailUrl: 'thumbnails/clip-1.webp',
    keywords: ['focus'],
    hashtags: ['productivity'],
    topics: ['self-improvement'],
    intent: 'educate',
    ctaText: 'Subscribe for more',
    scores: {
      hookStrength: 80,
      educationalValue: 70,
      practicalValue: 60,
      curiosity: 50,
      emotion: 40,
      storytelling: 30,
      novelty: 20,
      trustAuthority: 10,
      ctaStrength: 65,
    },
    facialFeatures: null,
    ocrFeatures: null,
    audioFeatures: null,
    highlightScore: 72,
    highlightConfidence: 0.6,
    highlightReason: 'Strong hook and clear CTA',
    highlightBreakdown: null,
    highlightExplainability: null,
    highlightPrediction: null,
    highlightRecommendation: null,
    highlightRank: 1,
    ...overrides,
  } as unknown as PrismaClip;
}

describe('buildVideoReportInputFromPrisma', () => {
  it('narrows clips and filters segments per clip', () => {
    const clipA = baseClip({ id: 'a', startTime: 0, endTime: 10 });
    const clipB = baseClip({ id: 'b', startTime: 10, endTime: 20 });
    const input = buildVideoReportInputFromPrisma({
      video: { title: 'My video', thumbnailUrl: '/videos/v1/thumbnail', durationSeconds: 20 },
      clips: [clipA, clipB],
      segments: [
        { start: 0, end: 5, text: 'early', speaker: null, emotion: 'hap' },
        { start: 15, end: 18, text: 'late', speaker: null, emotion: 'sad' },
      ],
      statusEvents: [],
    });

    expect(input.video.title).toBe('My video');
    expect(input.clips).toHaveLength(2);
    expect(input.clips[0].segments).toEqual([{ emotion: 'hap' }]);
    expect(input.clips[1].segments).toEqual([{ emotion: 'sad' }]);
  });

  it('reads ctaStrength off the clip scores JSON column', () => {
    const input = buildVideoReportInputFromPrisma({
      video: { title: null, thumbnailUrl: null, durationSeconds: null },
      clips: [baseClip()],
      segments: [],
      statusEvents: [],
    });

    expect(input.clips[0].ctaStrength).toBe(65);
  });

  it('defaults highlightBreakdown/highlightExplainability for a clip whose Fusion Engine columns are null', () => {
    const input = buildVideoReportInputFromPrisma({
      video: { title: null, thumbnailUrl: null, durationSeconds: null },
      clips: [baseClip({ highlightBreakdown: null, highlightExplainability: null })],
      segments: [],
      statusEvents: [],
    });

    expect(input.clips[0].highlightBreakdown).toEqual([]);
    expect(input.clips[0].highlightTopFactors).toEqual([]);
  });

  it('derives the clip thumbnail endpoint path only when a raw thumbnail key exists', () => {
    const input = buildVideoReportInputFromPrisma({
      video: { title: null, thumbnailUrl: null, durationSeconds: null },
      clips: [
        baseClip({ id: 'has-thumb', thumbnailUrl: 'thumbnails/has-thumb.webp' }),
        baseClip({ id: 'no-thumb', thumbnailUrl: null }),
      ],
      segments: [],
      statusEvents: [],
    });

    expect(input.clips[0].thumbnailUrl).toBe('/clips/has-thumb/thumbnail');
    expect(input.clips[1].thumbnailUrl).toBeNull();
  });

  it('produces a valid input for buildVideoReportData end-to-end', () => {
    const input = buildVideoReportInputFromPrisma({
      video: { title: 'My video', thumbnailUrl: null, durationSeconds: 20 },
      clips: [baseClip()],
      segments: [],
      statusEvents: [
        { toStatus: 'RENDERED', occurredAt: '2026-07-17T03:00:00.000Z', errorMessage: null },
      ],
    });

    expect(() => buildVideoReportData(input)).not.toThrow();
  });
});
