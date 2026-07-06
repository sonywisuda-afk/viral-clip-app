import { z } from 'zod';

// The emoji-suggester module's whole input: the clip's own transcript text,
// already joined into one string by the adapter (see
// detect-clips.worker.ts) - the module has no notion of segments/words at
// all, just plain text in, suggested emoji out.
export const emojiSuggestionInputSchema = z.object({
  text: z.string(),
});

export const emojiSuggestionOutputSchema = z.object({
  emojis: z.array(z.string()),
});

export type EmojiSuggestionInput = z.infer<typeof emojiSuggestionInputSchema>;
export type EmojiSuggestionOutput = z.infer<typeof emojiSuggestionOutputSchema>;
