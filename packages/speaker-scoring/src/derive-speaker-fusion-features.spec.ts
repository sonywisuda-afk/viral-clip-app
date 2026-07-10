import type { ClipSpeakerScores } from './derive-clip-speaker-scores';
import { deriveSpeakerFusionFeatures } from './derive-speaker-fusion-features';

function scoresFixture(overrides: Partial<ClipSpeakerScores> = {}): ClipSpeakerScores {
  return {
    confidence: [],
    engagement: [],
    importance: [],
    highlightMoments: [],
    ...overrides,
  };
}

describe('deriveSpeakerFusionFeatures', () => {
  it('returns all-null when there are no speakers at all', () => {
    expect(deriveSpeakerFusionFeatures(scoresFixture())).toEqual({
      dominantSpeakerConfidence: null,
      dominantSpeakerEngagement: null,
      dominantSpeakerImportance: null,
      averageSpeakerHighlightScore: null,
    });
  });

  it('picks the speaker with the highest importance score as dominant, using THEIR OWN confidence/engagement', () => {
    const scores = scoresFixture({
      confidence: [
        {
          speakerId: 'Speaker A',
          eyeContactRate: null,
          headPoseStability: null,
          gestureActivity: null,
          voiceStability: null,
          speakingRateScore: null,
          overallScore: 0.2,
        },
        {
          speakerId: 'Speaker B',
          eyeContactRate: null,
          headPoseStability: null,
          gestureActivity: null,
          voiceStability: null,
          speakingRateScore: null,
          overallScore: 0.9,
        },
      ],
      engagement: [
        {
          speakerId: 'Speaker A',
          gestureScore: null,
          voiceEnergyScore: null,
          facialExpressionScore: null,
          speakingRateScore: null,
          overallScore: 0.3,
        },
        {
          speakerId: 'Speaker B',
          gestureScore: null,
          voiceEnergyScore: null,
          facialExpressionScore: null,
          speakingRateScore: null,
          overallScore: 0.8,
        },
      ],
      importance: [
        { speakerId: 'Speaker A', role: null, talkTimeRatio: 0.2, screenTimeRatio: 0.1, score: 20 },
        { speakerId: 'Speaker B', role: null, talkTimeRatio: 0.8, screenTimeRatio: 0.9, score: 90 },
      ],
    });

    const result = deriveSpeakerFusionFeatures(scores);

    expect(result.dominantSpeakerConfidence).toBe(0.9);
    expect(result.dominantSpeakerEngagement).toBe(0.8);
    expect(result.dominantSpeakerImportance).toBeCloseTo(0.9);
  });

  it('falls back to the first speaker when no one has a non-null importance score', () => {
    const scores = scoresFixture({
      confidence: [
        {
          speakerId: 'Speaker A',
          eyeContactRate: null,
          headPoseStability: null,
          gestureActivity: null,
          voiceStability: null,
          speakingRateScore: null,
          overallScore: 0.5,
        },
      ],
      importance: [
        {
          speakerId: 'Speaker A',
          role: null,
          talkTimeRatio: null,
          screenTimeRatio: null,
          score: null,
        },
      ],
    });

    expect(deriveSpeakerFusionFeatures(scores).dominantSpeakerConfidence).toBe(0.5);
  });

  it('averages highlightMoments.score across the whole clip, normalized to 0-1', () => {
    const scores = scoresFixture({
      highlightMoments: [
        {
          speakerId: 'Speaker A',
          start: 0,
          end: 5,
          isActiveSpeaker: null,
          emotionIntensity: null,
          gestureIntensity: null,
          eyeContactRate: null,
          hookStrength: null,
          score: 80,
        },
        {
          speakerId: 'Speaker A',
          start: 5,
          end: 10,
          isActiveSpeaker: null,
          emotionIntensity: null,
          gestureIntensity: null,
          eyeContactRate: null,
          hookStrength: null,
          score: 60,
        },
      ],
    });

    expect(deriveSpeakerFusionFeatures(scores).averageSpeakerHighlightScore).toBeCloseTo(0.7);
  });

  it('ignores null-scored moments when averaging highlight score', () => {
    const scores = scoresFixture({
      highlightMoments: [
        {
          speakerId: 'Speaker A',
          start: 0,
          end: 5,
          isActiveSpeaker: null,
          emotionIntensity: null,
          gestureIntensity: null,
          eyeContactRate: null,
          hookStrength: null,
          score: null,
        },
        {
          speakerId: 'Speaker A',
          start: 5,
          end: 10,
          isActiveSpeaker: null,
          emotionIntensity: null,
          gestureIntensity: null,
          eyeContactRate: null,
          hookStrength: null,
          score: 50,
        },
      ],
    });

    expect(deriveSpeakerFusionFeatures(scores).averageSpeakerHighlightScore).toBeCloseTo(0.5);
  });
});
