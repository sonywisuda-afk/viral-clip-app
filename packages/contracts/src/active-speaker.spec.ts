import {
  activeSpeakerSampleSchema,
  lipSyncVerificationSchema,
  speakerFaceAssociationSchema,
} from './active-speaker';

describe('activeSpeakerSampleSchema', () => {
  it('accepts a confident active-speaker reading', () => {
    const result = activeSpeakerSampleSchema.safeParse({
      t: 3.5,
      activeTrackId: 2,
      confidence: 0.98,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null activeTrackId (no face judged to be speaking)', () => {
    const result = activeSpeakerSampleSchema.safeParse({
      t: 3.5,
      activeTrackId: null,
      confidence: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('speakerFaceAssociationSchema', () => {
  it('accepts a matched association', () => {
    const result = speakerFaceAssociationSchema.safeParse({
      speaker: 'Speaker A',
      faceTrackId: 4,
      status: 'matched',
      confidence: 0.87,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an unknown association with a null faceTrackId', () => {
    const result = speakerFaceAssociationSchema.safeParse({
      speaker: 'Speaker B',
      faceTrackId: null,
      status: 'unknown',
      confidence: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('lipSyncVerificationSchema', () => {
  it('accepts a verified reading with a delay estimate', () => {
    const result = lipSyncVerificationSchema.safeParse({
      faceTrackId: 4,
      lipMotionScore: 0.7,
      audioSyncScore: 0.91,
      delayMs: 40,
      frameOffset: 1,
      verified: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all-null fields when inputs were insufficient to evaluate', () => {
    const result = lipSyncVerificationSchema.safeParse({
      faceTrackId: 4,
      lipMotionScore: null,
      audioSyncScore: null,
      delayMs: null,
      frameOffset: null,
      verified: null,
    });
    expect(result.success).toBe(true);
  });
});
