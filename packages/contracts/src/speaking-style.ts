import { z } from 'zod';

// Speaker Intelligence roadmap, Level 2 - Speaking Style Analysis. Mostly a
// rollup of audio-intelligence's ALREADY-computed
// averageSpeakingRateWordsPerSecond/speakingRateStdDev/averageRmsDb plus a
// pause classification derived from voice-activity.ts's silence segments -
// not a new subprocess. Contracts-first, no deriving function implemented
// yet.

// Thresholds for bucketing wordsPerSecond are unvalidated guesses, same
// honesty as every other classification bucket in this pipeline (e.g.
// editing-rhythm's tempo/pacing labels).
export const PACE_LABELS = ['slow', 'normal', 'fast'] as const;
export type PaceLabel = (typeof PACE_LABELS)[number];

export const speakingStyleFeaturesSchema = z.object({
  averageSpeakingRateWordsPerSecond: z.number().min(0).nullable(),
  paceLabel: z.enum(PACE_LABELS).nullable(),
  // Fraction of clip duration classified as a pause (a voice-activity.ts
  // `silence` segment that falls between two speech segments of the SAME
  // speaker - a silence at a speaker boundary is a turn gap, not a pause).
  pauseRate: z.number().min(0).max(1).nullable(),
  // Count of pauses whose duration crosses a "long pause" threshold -
  // distinct from face-landmarks' existing mouth-based `pauseCount` (a
  // visual proxy scoped to one tracked face); this is audio-derived and
  // clip-wide.
  longPauseCount: z.number().int().min(0).nullable(),
  // Reuses audio-intelligence's averageRmsDb - included here under the
  // roadmap's own "Voice Energy" vocabulary rather than duplicating the
  // measurement.
  averageVoiceEnergyDb: z.number().nullable(),
  // Pitch/F0 variation - explicitly NOT implemented anywhere in this
  // codebase yet (see docs/ai/audio.md's "Pitch/F0 — not implemented" note,
  // would need Python + librosa). Reserved so this schema doesn't need a
  // breaking change once that lands - always null until then.
  pitchVariation: z.number().min(0).nullable(),
});

export type SpeakingStyleFeatures = z.infer<typeof speakingStyleFeaturesSchema>;
