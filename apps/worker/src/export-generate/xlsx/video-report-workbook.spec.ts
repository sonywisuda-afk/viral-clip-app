import type { VideoReportData } from '@speedora/contracts';
import { buildVideoReportWorkbook } from './video-report-workbook';

// exceljs is a real CJS dependency (unlike @react-pdf/renderer) - no ESM
// wall here, so this uses the real library and reads the built workbook
// back through its own API rather than mocking anything.

function baseReport(overrides: Partial<VideoReportData> = {}): VideoReportData {
  return {
    cover: { videoTitle: 'How I 10x-ed my morning routine', thumbnailUrl: '/videos/v1/thumbnail' },
    videoSummary: { durationSeconds: 600, clipCount: 1, averageHighlightScore: 72 },
    timeline: {
      events: [
        { toStatus: 'RENDERED', occurredAt: '2026-07-17T03:00:00.000Z', errorMessage: null },
      ],
    },
    highlight: {
      entries: [
        {
          clipId: 'clip-1',
          highlightScore: 72,
          highlightConfidence: 0.6,
          highlightReason: 'Strong hook and clear CTA',
          breakdown: [],
          topFactors: [
            {
              signal: 'audio',
              feature: 'averageRmsDb',
              weightedContribution: 0.07,
              description: 'Loud and clear',
            },
          ],
          prediction: null,
          recommendation: null,
          highlightRank: 1,
        },
      ],
    },
    topMoments: { moments: [] },
    faceAnalysis: {
      entries: [
        {
          clipId: 'clip-1',
          features: {
            dominantEmotion: 'happy',
            emotionTransitions: 2,
            peakConfidence: 0.9,
            stability: 0.5,
          },
        },
      ],
    },
    speechAnalysis: {
      entries: [
        {
          clipId: 'clip-1',
          audioFeatures: null,
          vocalEmotion: { dominantEmotion: 'hap', counts: { hap: 2 } },
        },
      ],
    },
    ocrSummary: { entries: [{ clipId: 'clip-1', features: null }] },
    keyword: {
      entries: [
        {
          clipId: 'clip-1',
          keywords: ['focus'],
          hashtags: ['productivity'],
          topics: ['self-improvement'],
        },
      ],
    },
    cta: { entries: [{ clipId: 'clip-1', ctaText: 'Subscribe for more', ctaStrength: 65 }] },
    thumbnail: { entries: [{ clipId: 'clip-1', thumbnailUrl: '/clips/clip-1/thumbnail' }] },
    ...overrides,
  };
}

describe('buildVideoReportWorkbook', () => {
  it('creates the 3 expected sheets', () => {
    const workbook = buildVideoReportWorkbook(baseReport());
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Overview',
      'Clips',
      'AI Analysis',
    ]);
  });

  it('Overview sheet has the video title and summary values', () => {
    const workbook = buildVideoReportWorkbook(baseReport());
    const overview = workbook.getWorksheet('Overview')!;
    expect(overview.getRow(2).getCell(2).value).toBe('How I 10x-ed my morning routine');
    expect(overview.getRow(4).getCell(2).value).toBe(1); // Clip Count
  });

  it('Clips sheet has one row per clip with joined keyword/CTA data', () => {
    const workbook = buildVideoReportWorkbook(baseReport());
    const clips = workbook.getWorksheet('Clips')!;
    expect(clips.rowCount).toBe(2); // header + 1 clip
    const row = clips.getRow(2);
    expect(row.getCell(1).value).toBe('clip-1');
    expect(row.getCell(2).value).toBe(72); // highlightScore
    expect(row.getCell(5).value).toBe('Subscribe for more'); // ctaText
    expect(row.getCell(7).value).toBe('focus'); // keywords
  });

  it('AI Analysis sheet reads dominant face/vocal emotion per clip', () => {
    const workbook = buildVideoReportWorkbook(baseReport());
    const ai = workbook.getWorksheet('AI Analysis')!;
    const row = ai.getRow(2);
    expect(row.getCell(2).value).toBe('happy');
    expect(row.getCell(3).value).toBe('hap');
  });

  it('falls back to "n/a" for a clip with no keyword/CTA entry', () => {
    const workbook = buildVideoReportWorkbook(
      baseReport({ keyword: { entries: [] }, cta: { entries: [] } }),
    );
    const clips = workbook.getWorksheet('Clips')!;
    const row = clips.getRow(2);
    expect(row.getCell(5).value).toBe('n/a'); // ctaText
    expect(row.getCell(7).value).toBe('n/a'); // keywords
  });

  it('produces an empty Clips sheet (header only) for a video with zero clips', () => {
    const workbook = buildVideoReportWorkbook(
      baseReport({
        highlight: { entries: [] },
        cta: { entries: [] },
        keyword: { entries: [] },
        faceAnalysis: { entries: [] },
        speechAnalysis: { entries: [] },
        ocrSummary: { entries: [] },
      }),
    );
    expect(workbook.getWorksheet('Clips')!.rowCount).toBe(1);
  });
});
