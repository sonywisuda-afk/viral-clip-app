import type { ReportClipInput } from '@speedora/contracts';
import { buildHighlightSection, buildTopMomentsSection } from './highlights';

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

describe('buildHighlightSection', () => {
  it('narrows every highlight-related field per clip', () => {
    const clip = baseClip({
      id: 'a',
      highlightScore: 72,
      highlightConfidence: 0.6,
      highlightReason: 'Strong hook and clear CTA',
      highlightBreakdown: [
        {
          signal: 'audio',
          feature: 'averageRmsDb',
          rawValue: -18,
          normalizedValue: 0.7,
          weight: 0.1,
          weightedContribution: 0.07,
        },
      ],
      highlightTopFactors: [
        {
          signal: 'audio',
          feature: 'averageRmsDb',
          weightedContribution: 0.07,
          description: 'Loud and clear',
        },
      ],
      highlightPrediction: { bucket: 'likely_high_performer', rationale: 'Above median score' },
      highlightRecommendation: { action: 'publish', message: 'Ready to publish as-is' },
      highlightRank: 1,
    });

    expect(buildHighlightSection([clip])).toEqual({
      entries: [
        {
          clipId: 'a',
          highlightScore: 72,
          highlightConfidence: 0.6,
          highlightReason: 'Strong hook and clear CTA',
          breakdown: clip.highlightBreakdown,
          topFactors: clip.highlightTopFactors,
          prediction: clip.highlightPrediction,
          recommendation: clip.highlightRecommendation,
          highlightRank: 1,
        },
      ],
    });
  });
});

describe('buildTopMomentsSection', () => {
  it('sorts by highlightRank ascending when every clip is ranked', () => {
    const clips = [
      baseClip({ id: 'a', highlightRank: 2 }),
      baseClip({ id: 'b', highlightRank: 1 }),
      baseClip({ id: 'c', highlightRank: 3 }),
    ];
    expect(buildTopMomentsSection(clips).moments.map((m) => m.clipId)).toEqual(['b', 'a', 'c']);
  });

  it('places unranked clips after ranked ones, ordered by highlightScore', () => {
    const clips = [
      baseClip({ id: 'unranked-low', highlightRank: null, highlightScore: 10 }),
      baseClip({ id: 'ranked', highlightRank: 1, highlightScore: 50 }),
      baseClip({ id: 'unranked-high', highlightRank: null, highlightScore: 90 }),
    ];
    expect(buildTopMomentsSection(clips).moments.map((m) => m.clipId)).toEqual([
      'ranked',
      'unranked-high',
      'unranked-low',
    ]);
  });

  it('caps the result at the given limit', () => {
    const clips = [1, 2, 3, 4].map((n) => baseClip({ id: `clip-${n}`, highlightRank: n }));
    expect(buildTopMomentsSection(clips, 2).moments).toHaveLength(2);
  });

  it('defaults to a limit of 5', () => {
    const clips = [1, 2, 3, 4, 5, 6].map((n) => baseClip({ id: `clip-${n}`, highlightRank: n }));
    expect(buildTopMomentsSection(clips).moments).toHaveLength(5);
  });
});
