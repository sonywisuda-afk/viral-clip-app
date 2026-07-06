import { z } from 'zod';

// A clip-relative time range to cut (0 = clip start) - shared by the
// cutlist module itself, apps/worker's render-clip adapter, and ffmpeg.ts's
// trimCutRanges()/computeCutJunctionTimestamps consumers.
export const cutRangeSchema = z.object({
  start: z.number(),
  end: z.number(),
});

export type CutRange = z.infer<typeof cutRangeSchema>;
