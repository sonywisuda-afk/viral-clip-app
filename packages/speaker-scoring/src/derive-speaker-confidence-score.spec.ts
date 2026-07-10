import { deriveSpeakerConfidenceScore } from './derive-speaker-confidence-score';
import { NULL_AUDIO_FEATURES, NULL_FACE_FEATURES, NULL_GESTURE_FEATURES } from './test-fixtures';

describe('deriveSpeakerConfidenceScore', () => {
  it('returns all-null (including overallScore) when every input is null', () => {
    const result = deriveSpeakerConfidenceScore('Speaker A', null, null, null);
    expect(result).toEqual({
      speakerId: 'Speaker A',
      eyeContactRate: null,
      headPoseStability: null,
      gestureActivity: null,
      voiceStability: null,
      speakingRateScore: null,
      overallScore: null,
    });
  });

  it('passes eyeContactRate through unchanged (already 0-1 by contract)', () => {
    const result = deriveSpeakerConfidenceScore(
      'Speaker A',
      { ...NULL_FACE_FEATURES, eyeContactRate: 0.8 },
      null,
      null,
    );
    expect(result.eyeContactRate).toBe(0.8);
  });

  it('inverts averageHeadMovementRate into a stability score (steadier = higher)', () => {
    const steady = deriveSpeakerConfidenceScore(
      'Speaker A',
      { ...NULL_FACE_FEATURES, averageHeadMovementRate: 0 },
      null,
      null,
    );
    const shaky = deriveSpeakerConfidenceScore(
      'Speaker A',
      { ...NULL_FACE_FEATURES, averageHeadMovementRate: 30 },
      null,
      null,
    );
    expect(steady.headPoseStability).toBe(1);
    expect(shaky.headPoseStability).toBe(0);
  });

  it('reads gestureActivity from gestureFeatures.peakConfidence when gesture data is attributed', () => {
    const result = deriveSpeakerConfidenceScore(
      'Speaker A',
      null,
      { ...NULL_GESTURE_FEATURES, peakConfidence: 0.9 },
      null,
    );
    expect(result.gestureActivity).toBe(0.9);
  });

  it('inverts speakingRateStdDev into voiceStability and normalizes averageSpeakingRateWordsPerSecond', () => {
    const result = deriveSpeakerConfidenceScore('Speaker A', null, null, {
      ...NULL_AUDIO_FEATURES,
      speakingRateStdDev: 0,
      averageSpeakingRateWordsPerSecond: 4,
    });
    expect(result.voiceStability).toBe(1);
    expect(result.speakingRateScore).toBe(1);
  });

  it('averages only the available components into overallScore', () => {
    const result = deriveSpeakerConfidenceScore(
      'Speaker A',
      { ...NULL_FACE_FEATURES, eyeContactRate: 1 },
      null,
      { ...NULL_AUDIO_FEATURES, speakingRateStdDev: 0 },
    );
    // eyeContactRate=1, voiceStability=1, everything else null -> average of just those two.
    expect(result.overallScore).toBe(1);
  });
});
