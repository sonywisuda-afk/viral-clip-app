import { speakerTimelineEntrySchema, speakerTransitionSchema } from './speaker-timeline';

describe('speakerTimelineEntrySchema', () => {
  it('accepts an entry with face association data', () => {
    const result = speakerTimelineEntrySchema.safeParse({
      speaker: 'Speaker A',
      start: 0,
      end: 18,
      faceTrackId: 4,
      isActiveOnScreen: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null faceTrackId/isActiveOnScreen when no association data exists', () => {
    const result = speakerTimelineEntrySchema.safeParse({
      speaker: 'Speaker B',
      start: 18,
      end: 31,
      faceTrackId: null,
      isActiveOnScreen: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('speakerTransitionSchema', () => {
  it('accepts a null fromSpeaker for the first transition', () => {
    const result = speakerTransitionSchema.safeParse({
      t: 0,
      fromSpeaker: null,
      toSpeaker: 'Speaker A',
    });
    expect(result.success).toBe(true);
  });
});
