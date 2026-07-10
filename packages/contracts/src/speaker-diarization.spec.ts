import {
  diarizationFeaturesSchema,
  overlappingSpeechIntervalSchema,
  speakerMetadataSchema,
  speakerTurnSchema,
} from './speaker-diarization';

describe('speakerTurnSchema', () => {
  it('accepts a friendly-labeled turn', () => {
    const result = speakerTurnSchema.safeParse({ speaker: 'Speaker A', start: 12.3, end: 18.42 });
    expect(result.success).toBe(true);
  });
});

describe('overlappingSpeechIntervalSchema', () => {
  it('requires at least 2 speakers', () => {
    const result = overlappingSpeechIntervalSchema.safeParse({
      start: 0,
      end: 1,
      speakers: ['Speaker A'],
    });
    expect(result.success).toBe(false);
  });
});

describe('diarizationFeaturesSchema', () => {
  it('accepts a fully-populated aggregate', () => {
    const result = diarizationFeaturesSchema.safeParse({
      speakerCount: 2,
      segments: [{ speaker: 'Speaker A', start: 0, end: 5, durationSeconds: 5 }],
      speakerDurationsSeconds: { 'Speaker A': 5, 'Speaker B': 3 },
      turnCount: 2,
      switchCount: 1,
      overlappingSpeech: [],
      silences: [{ start: 5, end: 5.5 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('speakerMetadataSchema', () => {
  it('accepts gender/language as null (no detector implemented yet)', () => {
    const result = speakerMetadataSchema.safeParse({
      speakerId: 'Speaker A',
      faceTrackId: 4,
      gender: null,
      language: null,
      durationSeconds: 183.2,
      confidence: 0.98,
    });
    expect(result.success).toBe(true);
  });
});
