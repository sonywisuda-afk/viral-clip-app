import type { Clip, TranscriptSegment } from '@speedora/shared';
import { buildVideoReportCsv, buildVideoReportInput, toReportClipInput } from './video-report.util';
import { buildVideoReportData } from '@speedora/report-builder';

// Only the fields VideosService.mapVideoWithClips actually narrows and this
// util actually reads are given real values - the rest of Clip's many
// AI-signal fields are irrelevant here, so the cast avoids a 40+ field
// fixture no test in this file needs.
function baseClip(overrides: Partial<Clip> = {}): Clip {
  return {
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
    highlightBreakdown: [],
    highlightExplainability: { topFactors: [] },
    highlightPrediction: null,
    highlightRecommendation: null,
    highlightRank: 1,
    ...overrides,
  } as unknown as Clip;
}

describe('toReportClipInput', () => {
  it('narrows a Clip DTO into ReportClipInput, reading ctaStrength off scores', () => {
    const result = toReportClipInput(baseClip(), []);
    expect(result.id).toBe('clip-1');
    expect(result.ctaText).toBe('Subscribe for more');
    expect(result.ctaStrength).toBe(65);
    expect(result.highlightTopFactors).toEqual([]);
    expect(result.segments).toEqual([]);
  });

  it('reports null ctaStrength when the clip has no scores at all', () => {
    const result = toReportClipInput(baseClip({ scores: null }), []);
    expect(result.ctaStrength).toBeNull();
  });

  it('narrows clip-scoped segments down to just their emotion label', () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: 'hi', emotion: 'hap' },
      { start: 5, end: 10, text: 'bye' },
    ];
    const result = toReportClipInput(baseClip(), segments);
    expect(result.segments).toEqual([{ emotion: 'hap' }, { emotion: undefined }]);
  });
});

describe('buildVideoReportInput', () => {
  it('filters each clip down to its own overlapping segments', () => {
    const clipA = baseClip({ id: 'a', startTime: 0, endTime: 10 });
    const clipB = baseClip({ id: 'b', startTime: 10, endTime: 20 });
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: 'early', emotion: 'hap' },
      { start: 15, end: 18, text: 'late', emotion: 'sad' },
    ];

    const input = buildVideoReportInput(
      {
        title: 'My video',
        thumbnailUrl: '/videos/v1/thumbnail',
        durationSeconds: 20,
        clips: [clipA, clipB],
      },
      segments,
      [],
    );

    expect(input.clips[0].segments).toEqual([{ emotion: 'hap' }]);
    expect(input.clips[1].segments).toEqual([{ emotion: 'sad' }]);
  });

  it('is a valid input for buildVideoReportData end-to-end', () => {
    const input = buildVideoReportInput(
      { title: 'My video', thumbnailUrl: null, durationSeconds: 20, clips: [baseClip()] },
      [],
      [],
    );
    expect(() => buildVideoReportData(input)).not.toThrow();
  });
});

describe('buildVideoReportCsv', () => {
  it('renders the flat summary sections, not the nested per-signal detail', () => {
    const input = buildVideoReportInput(
      {
        title: 'My video',
        thumbnailUrl: '/videos/v1/thumbnail',
        durationSeconds: 20,
        clips: [baseClip()],
      },
      [],
      [{ toStatus: 'RENDERED', occurredAt: '2026-07-17T03:00:00.000Z', errorMessage: null }],
    );
    const csv = buildVideoReportCsv(buildVideoReportData(input));

    expect(csv).toContain('Cover,,Video Title,My video');
    expect(csv).toContain('Video Summary,,Clip Count,1');
    expect(csv).toContain('Timeline,,2026-07-17T03:00:00.000Z,RENDERED');
    expect(csv).toContain('Highlight,clip-1,Score,72');
    expect(csv).toContain('Keyword,clip-1,Keywords,focus');
    expect(csv).toContain('CTA,clip-1,Text,Subscribe for more');
    expect(csv).not.toContain('faceAnalysis');
  });

  it('falls back to "n/a" for null values', () => {
    const input = buildVideoReportInput(
      { title: null, thumbnailUrl: null, durationSeconds: null, clips: [] },
      [],
      [],
    );
    const csv = buildVideoReportCsv(buildVideoReportData(input));
    expect(csv).toContain('Cover,,Video Title,n/a');
    expect(csv).toContain('Video Summary,,Average Highlight Score,n/a');
  });
});
