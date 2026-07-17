import type { ReportClipInput } from '@speedora/contracts';
import {
  buildCtaSection,
  buildFaceAnalysisSection,
  buildKeywordSection,
  buildOcrSummarySection,
  buildSpeechAnalysisSection,
} from './content-signals';

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

describe('buildFaceAnalysisSection', () => {
  it('passes facialFeatures through unchanged, keyed by clip', () => {
    const features = {
      dominantEmotion: 'happy',
      emotionTransitions: 3,
      peakConfidence: 0.9,
      stability: 0.5,
    };
    expect(buildFaceAnalysisSection([baseClip({ id: 'a', facialFeatures: features })])).toEqual({
      entries: [{ clipId: 'a', features }],
    });
  });

  it('passes null through for a clip with no facial analysis', () => {
    expect(buildFaceAnalysisSection([baseClip({ id: 'a' })])).toEqual({
      entries: [{ clipId: 'a', features: null }],
    });
  });
});

describe('buildSpeechAnalysisSection', () => {
  it('summarizes the dominant vocal emotion and per-label counts', () => {
    const clip = baseClip({
      id: 'a',
      segments: [{ emotion: 'hap' }, { emotion: 'hap' }, { emotion: 'neu' }],
    });
    expect(buildSpeechAnalysisSection([clip])).toEqual({
      entries: [
        {
          clipId: 'a',
          audioFeatures: null,
          vocalEmotion: { dominantEmotion: 'hap', counts: { hap: 2, neu: 1 } },
        },
      ],
    });
  });

  it('ignores segments with no emotion label', () => {
    const clip = baseClip({ id: 'a', segments: [{}, { emotion: 'sad' }] });
    expect(buildSpeechAnalysisSection([clip]).entries[0].vocalEmotion).toEqual({
      dominantEmotion: 'sad',
      counts: { sad: 1 },
    });
  });

  it('reports a null dominant emotion when no segment has one', () => {
    const clip = baseClip({ id: 'a', segments: [{}, {}] });
    expect(buildSpeechAnalysisSection([clip]).entries[0].vocalEmotion).toEqual({
      dominantEmotion: null,
      counts: {},
    });
  });

  it('passes audioFeatures through unchanged', () => {
    const audioFeatures = {
      averageRmsDb: -20,
      peakDb: -6,
      averageSpeakingRateWordsPerSecond: 2.5,
      speakingRateStdDev: 0.3,
    };
    const clip = baseClip({ id: 'a', audioFeatures });
    expect(buildSpeechAnalysisSection([clip]).entries[0].audioFeatures).toEqual(audioFeatures);
  });
});

describe('buildOcrSummarySection', () => {
  it('passes ocrFeatures through unchanged, keyed by clip', () => {
    const features = {
      subtitleCoverageRate: 0.8,
      slidePresenceRate: 0,
      captionRate: 0.5,
      logoPresenceRate: 0,
      priceMentionRate: 0,
      nameMentionRate: 0,
      dominantTextCategory: 'subtitle',
      averageTextBlockCount: 1.2,
    };
    expect(buildOcrSummarySection([baseClip({ id: 'a', ocrFeatures: features })])).toEqual({
      entries: [{ clipId: 'a', features }],
    });
  });
});

describe('buildKeywordSection', () => {
  it('carries keywords/hashtags/topics through per clip', () => {
    const clip = baseClip({
      id: 'a',
      keywords: ['focus'],
      hashtags: ['productivity'],
      topics: ['self-improvement'],
    });
    expect(buildKeywordSection([clip])).toEqual({
      entries: [
        {
          clipId: 'a',
          keywords: ['focus'],
          hashtags: ['productivity'],
          topics: ['self-improvement'],
        },
      ],
    });
  });
});

describe('buildCtaSection', () => {
  it('reads ctaText/ctaStrength straight through, never recomputing them', () => {
    const clip = baseClip({ id: 'a', ctaText: 'Subscribe for more', ctaStrength: 65 });
    expect(buildCtaSection([clip])).toEqual({
      entries: [{ clipId: 'a', ctaText: 'Subscribe for more', ctaStrength: 65 }],
    });
  });

  it('passes nulls through for a clip with no CTA', () => {
    expect(buildCtaSection([baseClip({ id: 'a' })])).toEqual({
      entries: [{ clipId: 'a', ctaText: null, ctaStrength: null }],
    });
  });
});
