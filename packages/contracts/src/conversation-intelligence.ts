import { z } from 'zod';

// Speaker Intelligence roadmap, Level 3 - Conversation Type Classification.
// Derived purely from already-computed speaker-diarization.ts features
// (speakerCount, turnCount, switchCount, turn-length distribution) via a
// deterministic heuristic - NOT a trained model, same "heuristic, not
// calibrated against real data" honesty as every other classification in
// this pipeline (see coding-standards.md). Contracts-first, no classifying
// function implemented yet.
export const CONVERSATION_TYPES = [
  'monologue',
  'interview',
  'discussion',
  'debate',
  'presentation',
  'podcast',
] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const classifyConversationTypeInputSchema = z.object({
  speakerCount: z.number().int().min(0),
  turnCount: z.number().int().min(0),
  switchCount: z.number().int().min(0),
  averageTurnDurationSeconds: z.number().min(0).nullable(),
});

// null type means there wasn't enough diarization data to classify at all
// (e.g. speakerCount is 0 - diarization never ran or found no turns) - not
// a fabricated default like 'monologue'.
export const conversationTypeResultSchema = z.object({
  type: z.enum(CONVERSATION_TYPES).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

export type ClassifyConversationTypeInput = z.infer<typeof classifyConversationTypeInputSchema>;
export type ConversationTypeResult = z.infer<typeof conversationTypeResultSchema>;
