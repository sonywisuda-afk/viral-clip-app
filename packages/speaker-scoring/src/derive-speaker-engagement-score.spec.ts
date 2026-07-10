import { deriveSpeakerEngagementScore } from './derive-speaker-engagement-score';
import { NULL_AUDIO_FEATURES, NULL_FACE_FEATURES, NULL_GESTURE_FEATURES } from './test-fixtures';

describe('deriveSpeakerEngagementScore', () => {
  it('returns all-null (including overallScore) when every input is null', () => {
    const result = deriveSpeakerEngagementScore('Speaker A', null, null, null);
    expect(result).toEqual({
      speakerId: 'Speaker A',
      gestureScore: null,
      voiceEnergyScore: null,
      facialExpressionScore: null,
      speakingRateScore: null,
      overallScore: null,
    });
  });

  it('reads gestureScore from gestureFeatures.peakConfidence', () => {
    const result = deriveSpeakerEngagementScore(
      'Speaker A',
      null,
      { ...NULL_GESTURE_FEATURES, peakConfidence: 0.7 },
      null,
    );
    expect(result.gestureScore).toBe(0.7);
  });

  it('normalizes averageRmsDb into voiceEnergyScore using the same cap as fusion-engine', () => {
    const result = deriveSpeakerEngagementScore('Speaker A', null, null, {
      ...NULL_AUDIO_FEATURES,
      averageRmsDb: -10,
    });
    expect(result.voiceEnergyScore).toBe(1);
  });

  it('averages averageSmile and averageBrowActivity into facialExpressionScore', () => {
    const result = deriveSpeakerEngagementScore(
      'Speaker A',
      { ...NULL_FACE_FEATURES, averageSmile: 0.8, averageBrowActivity: 0.4 },
      null,
      null,
    );
    expect(result.facialExpressionScore).toBeCloseTo(0.6);
  });

  it('falls back to just one component when only one of smile/brow is available', () => {
    const result = deriveSpeakerEngagementScore(
      'Speaker A',
      { ...NULL_FACE_FEATURES, averageSmile: 0.9 },
      null,
      null,
    );
    expect(result.facialExpressionScore).toBe(0.9);
  });
});
