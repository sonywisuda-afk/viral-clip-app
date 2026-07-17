// Same ESM/CJS mock as video-report-document.spec.ts - see that file's own
// comment for why @react-pdf/renderer is mocked rather than loaded for
// real in Jest.
jest.mock('@react-pdf/renderer', () => ({
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
}));

import type { VideoReportData } from '@speedora/contracts';
import { buildHighlightReportDocument } from './highlight-report-document';

function baseReport(overrides: Partial<VideoReportData> = {}): VideoReportData {
  return {
    cover: { videoTitle: 'How I 10x-ed my morning routine', thumbnailUrl: '/videos/v1/thumbnail' },
    videoSummary: { durationSeconds: 600, clipCount: 1, averageHighlightScore: 72 },
    timeline: { events: [] },
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
    faceAnalysis: { entries: [] },
    speechAnalysis: { entries: [] },
    ocrSummary: { entries: [] },
    keyword: { entries: [] },
    cta: { entries: [] },
    thumbnail: { entries: [] },
    ...overrides,
  };
}

describe('buildHighlightReportDocument', () => {
  it('does not throw for a fully-populated report', () => {
    expect(() => buildHighlightReportDocument(baseReport())).not.toThrow();
  });

  it('does not throw for a video with zero clips', () => {
    const empty = baseReport({ highlight: { entries: [] }, topMoments: { moments: [] } });
    expect(() => buildHighlightReportDocument(empty)).not.toThrow();
  });
});
