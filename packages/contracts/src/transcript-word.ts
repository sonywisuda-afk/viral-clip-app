import { z } from 'zod';

// A single word-level timestamp, shared by every module here that reads
// Whisper's word-level data (clip-scoring, cutlist, subtitles) - extracted
// once multiple modules needed the exact same shape, rather than each
// module defining its own copy (same "extract at 2nd/3rd duplication"
// convention as the rest of this codebase).
export const transcriptWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export type TranscriptWordInput = z.infer<typeof transcriptWordSchema>;
