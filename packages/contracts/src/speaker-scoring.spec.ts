import {
  rankedSpeakerMomentSchema,
  speakerFusionFeaturesSchema,
  speakerHighlightMomentSchema,
  speakerImportanceScoreSchema,
} from './speaker-scoring';

describe('speakerImportanceScoreSchema', () => {
  it('accepts a host with a high score', () => {
    const result = speakerImportanceScoreSchema.safeParse({
      speakerId: 'Speaker A',
      role: 'host',
      talkTimeRatio: 0.6,
      screenTimeRatio: 0.7,
      score: 100,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null role (no manual tagging supplied)', () => {
    const result = speakerImportanceScoreSchema.safeParse({
      speakerId: 'Speaker B',
      role: null,
      talkTimeRatio: null,
      screenTimeRatio: null,
      score: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('speakerHighlightMomentSchema', () => {
  it('accepts a fully-populated moment', () => {
    const result = speakerHighlightMomentSchema.safeParse({
      speakerId: 'Speaker A',
      start: 10,
      end: 18,
      isActiveSpeaker: true,
      emotionIntensity: 0.8,
      gestureIntensity: 0.6,
      eyeContactRate: 0.5,
      hookStrength: 90,
      score: 85,
    });
    expect(result.success).toBe(true);
  });
});

describe('rankedSpeakerMomentSchema', () => {
  it('requires rank to be a positive integer', () => {
    const result = rankedSpeakerMomentSchema.safeParse({
      speakerId: 'Speaker A',
      start: 0,
      end: 10,
      score: 90,
      rank: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('speakerFusionFeaturesSchema', () => {
  it('accepts all-null fields (no speaker turns for this clip)', () => {
    const result = speakerFusionFeaturesSchema.safeParse({
      dominantSpeakerConfidence: null,
      dominantSpeakerEngagement: null,
      dominantSpeakerImportance: null,
      averageSpeakerHighlightScore: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-populated feature set', () => {
    const result = speakerFusionFeaturesSchema.safeParse({
      dominantSpeakerConfidence: 0.8,
      dominantSpeakerEngagement: 0.7,
      dominantSpeakerImportance: 0.9,
      averageSpeakerHighlightScore: 0.65,
    });
    expect(result.success).toBe(true);
  });
});
