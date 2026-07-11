import { z } from 'zod';

// Primary Subject Selection - a deliberately STANDALONE, non-composition-
// specific package (packages/primary-subject), per explicit user
// architectural direction: "which entity is the subject of this frame" is
// a question Composition Intelligence needs, but so will Thumbnail
// Intelligence, Reframe, and any future Multi-Subject work - putting the
// selection order in the worker (or inside composition-intelligence
// itself) would make it a hidden, composition-only implementation detail
// instead of a reusable building block. This file is the shared output
// contract every one of those future consumers reads.
//
// Documented order (see docs/ai/composition-intelligence.md's "Primary
// Subject Selection" section for the original rationale) - first
// candidate that has data for a given sampled instant wins:
//   1. Active speaker (once a face is confidently identified as talking)
//   2. Largest visible face
//   3. Largest tracked person
//   4. Highest objectAttentionScore
//   5. Largest tracked object
export const PRIMARY_SUBJECT_SOURCES = [
  'active_speaker',
  'face',
  'tracked_person',
  'attention_object',
  'tracked_object',
] as const;
export type PrimarySubjectSource = (typeof PRIMARY_SUBJECT_SOURCES)[number];

// One sampled instant's selection result. Deliberately the SAME shape
// composition-intelligence.ts's compositionSampleSchema expects
// (box/trackId/facingYaw/t) - not a coincidence, that contract was
// designed to consume exactly this - but kept as its own type here so a
// future consumer (Thumbnail Intelligence, Reframe) isn't forced to import
// anything composition-specific to use it.
export const primarySubjectSampleSchema = z.object({
  t: z.number(),
  box: z
    .object({
      xCenter: z.number(),
      yCenter: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  // A face-landmarks trackId or an ObjectTrack.trackId depending on
  // `source` - package-agnostic, just a number. Null exactly when box is
  // null.
  trackId: z.number().int().nullable(),
  // Only ever populated when source is 'active_speaker' or 'face' (the two
  // face-sourced rules) - object-sourced selections (tracked_person/
  // attention_object/tracked_object) have no facing-direction signal
  // available, same "not every source can populate every field" honesty
  // as every other proxy in this pipeline.
  facingYaw: z.number().nullable(),
  // WHICH selection rule produced this sample - null exactly when box is
  // null (no candidate at all). Kept for explainability/debugging, not
  // consumed by any downstream scoring today.
  source: z.enum(PRIMARY_SUBJECT_SOURCES).nullable(),
});
export type PrimarySubjectSample = z.infer<typeof primarySubjectSampleSchema>;

export const primarySubjectTimelineSchema = z.array(primarySubjectSampleSchema);
export type PrimarySubjectTimeline = z.infer<typeof primarySubjectTimelineSchema>;
