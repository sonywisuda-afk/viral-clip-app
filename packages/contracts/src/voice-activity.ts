import { z } from 'zod';
import { intelligenceSignalSchema } from './intelligence-signal';

// Speaker Intelligence roadmap, Level 1 (mandatory) - Voice Activity
// Detection. Milestone A implementation: apps/worker/scripts/
// detect_voice_activity.py, py-webrtcvad (explicit user choice over Silero
// VAD - a small classic DSP/GMM-based library, not a new torch dependency)
// over the SAME full-track audio diarization already extracts (see
// docs/ai/audio.md's `diarizeAudioPath`) - no new ffmpeg extraction needed.
// webrtcvad itself only ever distinguishes speech vs non-speech; this
// script adds one cheap refinement (a local RMS-energy check on non-speech
// frames) to further split out `silence` - see the script's own module
// comment. `noise`/`music`/`crowd` remain reserved categories only:
// distinguishing them from generic non-speech reliably needs a dedicated
// audio-event classifier this pipeline doesn't have - kept in the enum now
// so persisted data/UI don't need a breaking schema change later.
export const VOICE_ACTIVITY_CATEGORIES = [
  'speech',
  'non_speech',
  'silence',
  'noise',
  'music',
  'crowd',
] as const;
export type VoiceActivityCategory = (typeof VOICE_ACTIVITY_CATEGORIES)[number];

export const detectVoiceActivityInputSchema = z.object({
  audioPath: z.string().min(1),
  // Needed to close off the final segment after the last state change -
  // webrtcvad only ever reports frame-by-frame decisions, it has no notion
  // of "and then the track just ends," so the caller must supply the
  // track's own duration, same as getMediaDurationSeconds() already
  // computed once per video in transcribe.worker.ts for other purposes.
  durationSeconds: z.number().min(0),
});

// One classified interval of the full-track timeline - absolute seconds,
// same clock as TranscriptSegment.start/end and SpeakerTurn (see
// speaker-diarization.ts), not clip-relative.
export const voiceActivitySegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  category: z.enum(VOICE_ACTIVITY_CATEGORIES),
  confidence: z.number().min(0).max(1).nullable(),
});

export const detectVoiceActivityOutputSchema = z.array(voiceActivitySegmentSchema);

// Derived summary (see intelligence-signal.ts) - the dense features other
// modules (Speaking Style, Speaker Timeline's silence gaps) are expected to
// consume rather than re-deriving from the raw segment list themselves.
export const voiceActivityFeaturesSchema = z.object({
  speechRatio: z.number().min(0).max(1).nullable(),
  silenceRatio: z.number().min(0).max(1).nullable(),
  silenceSegmentCount: z.number().int().min(0).nullable(),
  longestSilenceSeconds: z.number().min(0).nullable(),
});

export const voiceActivitySignalSchema = intelligenceSignalSchema(
  voiceActivitySegmentSchema,
  voiceActivityFeaturesSchema,
);

export type DetectVoiceActivityInput = z.infer<typeof detectVoiceActivityInputSchema>;
export type VoiceActivitySegment = z.infer<typeof voiceActivitySegmentSchema>;
export type VoiceActivityFeatures = z.infer<typeof voiceActivityFeaturesSchema>;
export type VoiceActivitySignal = z.infer<typeof voiceActivitySignalSchema>;
