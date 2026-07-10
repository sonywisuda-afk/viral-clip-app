import { z } from 'zod';

// Formalizes apps/worker/src/vocalEmotion.ts's own `EmotionSegment`/
// `EmotionResult` interfaces (superb/wav2vec2-base-superb-er, see
// docs/ai/audio.md) as a real Zod contract - same "close the unchecked-cast
// gap" reasoning as speaker-diarization.ts. Unlike Face Intelligence's
// `dominantAffect` (deliberately restricted to safe, non-diagnostic labels
// per explicit user instruction - see facial-intelligence.ts's
// AFFECT_LABELS comment), this module already ships DISCRETE emotion labels
// (the model's own 4-class IEMOCAP taxonomy) - that choice predates this
// contract and is left as-is here, not revisited; it is a real, documented
// tension with Face Intelligence's safety constraint (see
// docs/ai/speaker-intelligence.md's "Emotion While Speaking" section) that
// a future decision should reconcile explicitly rather than silently.
// The model's OWN raw label strings (superb/wav2vec2-base-superb-er's
// IEMOCAP taxonomy), NOT expanded to full words - matches
// detect_vocal_emotion.py's literal `top["label"]` output and
// TranscriptSegment.emotion's existing storage convention (see
// database schema.prisma's own comment on that column) exactly, so this
// contract validates real data rather than a prettified guess at its shape.
export const VOCAL_EMOTIONS = ['neu', 'hap', 'ang', 'sad'] as const;
export type VocalEmotion = (typeof VOCAL_EMOTIONS)[number];

export const emotionSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
});

export const detectVocalEmotionsInputSchema = z.object({
  audioPath: z.string().min(1),
  segments: z.array(emotionSegmentSchema),
});

// null means the script skipped this segment (too short to classify
// meaningfully - see detect_vocal_emotion.py's MIN_SEGMENT_SECONDS), aligned
// by index to the input `segments` array, same convention as every other
// per-segment/per-sample nullable result in this pipeline.
export const vocalEmotionResultSchema = z
  .object({
    emotion: z.enum(VOCAL_EMOTIONS),
    score: z.number().min(0).max(1),
  })
  .nullable();

export const detectVocalEmotionsOutputSchema = z.array(vocalEmotionResultSchema);

export type EmotionSegment = z.infer<typeof emotionSegmentSchema>;
export type DetectVocalEmotionsInput = z.infer<typeof detectVocalEmotionsInputSchema>;
export type VocalEmotionResult = z.infer<typeof vocalEmotionResultSchema>;
