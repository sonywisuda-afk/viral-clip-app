// @react-pdf/renderer ships ESM-only (confirmed by a real Jest run failing
// with "Cannot use import statement outside a module" - not a guess) and
// this monorepo's Jest setup only transforms .ts files via ts-jest, never
// node_modules .js - the same wall every worker spec that touches this
// package avoids by mocking it (see export-generate.worker.spec.ts). Real,
// non-mocked components stand in here as opaque string tags - React.
// createElement never invokes `type`, it only stores it, so this is enough
// to exercise buildVideoReportDocument's own branching/null-handling across
// all 11 sections without needing the real ESM package loaded in Jest. The
// real end-to-end render (actual PDF bytes out of the real package) was
// verified once manually via `tsx` outside Jest - see this file's own
// comment below for why that's not also a Jest-gated test.
jest.mock('@react-pdf/renderer', () => ({
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
}));

import type { VideoReportData } from '@speedora/contracts';
import { buildVideoReportDocument } from './video-report-document';

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
    topMoments: {
      moments: [
        {
          clipId: 'clip-1',
          hookText: 'You will not believe this',
          thumbnailUrl: null,
          highlightScore: 72,
          highlightRank: 1,
        },
      ],
    },
    faceAnalysis: { entries: [{ clipId: 'clip-1', features: null }] },
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

describe('buildVideoReportDocument', () => {
  it('does not throw for a fully-populated report', () => {
    expect(() => buildVideoReportDocument(baseReport())).not.toThrow();
  });

  it('does not throw for a video with zero clips', () => {
    const empty = baseReport({
      highlight: { entries: [] },
      topMoments: { moments: [] },
      faceAnalysis: { entries: [] },
      speechAnalysis: { entries: [] },
      ocrSummary: { entries: [] },
      keyword: { entries: [] },
      cta: { entries: [] },
      thumbnail: { entries: [] },
    });
    expect(() => buildVideoReportDocument(empty)).not.toThrow();
  });

  it('does not throw for a video whose title/timeline are empty', () => {
    const noMeta = baseReport({
      cover: { videoTitle: null, thumbnailUrl: null },
      timeline: { events: [] },
    });
    expect(() => buildVideoReportDocument(noMeta)).not.toThrow();
  });
});
