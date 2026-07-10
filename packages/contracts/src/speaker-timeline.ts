import { z } from 'zod';

// Speaker Intelligence roadmap, Level 1/2 - the unified Speaker Timeline:
// fuses speaker-diarization.ts's turns with active-speaker.ts's face
// association, so a caller gets "who is talking AND whose face is on
// screen" from one structure instead of joining two raw outputs itself.
// Contracts-first, no builder function implemented yet - see
// docs/ai/speaker-intelligence.md.
export const speakerTimelineEntrySchema = z.object({
  speaker: z.string(),
  start: z.number(),
  end: z.number(),
  faceTrackId: z.number().int().nullable(),
  // Null when no active-speaker/face-association data was supplied for
  // this entry at all (not merely "not the active speaker") - same
  // null-vs-false distinction as every other optional-signal field here.
  isActiveOnScreen: z.boolean().nullable(),
});

export const buildSpeakerTimelineOutputSchema = z.array(speakerTimelineEntrySchema);

// Speaker Transition Detection - one marker per point where the timeline's
// speaker changes. "Current/previous/next speaker" and "conversation flow"
// (Multi Speaker Tracking, roadmap #6) are deliberately NOT separate fields
// here - a caller answers those by looking up the entry/transition at a
// queried timestamp, so no redundant schema is needed for what's already
// derivable from `entries`/`transitions`.
export const speakerTransitionSchema = z.object({
  t: z.number(),
  // Null only for the very first transition marker (no prior speaker to
  // name) - a real "silence to first speaker" case, not a data gap.
  fromSpeaker: z.string().nullable(),
  toSpeaker: z.string(),
});

export const speakerTimelineFeaturesSchema = z.object({
  transitions: z.array(speakerTransitionSchema),
  transitionCount: z.number().int().min(0),
});

export type SpeakerTimelineEntry = z.infer<typeof speakerTimelineEntrySchema>;
export type SpeakerTransition = z.infer<typeof speakerTransitionSchema>;
export type SpeakerTimelineFeatures = z.infer<typeof speakerTimelineFeaturesSchema>;
