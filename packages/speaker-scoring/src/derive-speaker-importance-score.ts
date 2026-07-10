import type { SpeakerImportanceScore, SpeakerRole } from '@speedora/contracts';
import { averageAvailable } from './normalize';

// Speaker Intelligence roadmap, Milestone C - Speaker Importance.
// talkTimeRatio/screenTimeRatio are already computed by the caller
// (deriveClipSpeakerScores) - this function is a pure scoring rollup, not
// a detector. `role` is an explicit input per speaker-scoring.ts's own
// contract comment: no detector in this codebase can infer host/guest/
// audience, a caller (manual tagging, publish metadata) must supply it -
// it does NOT factor into `score` below (the composite is talk-time/
// screen-time only), it is passed through purely for display/downstream
// use.
export function deriveSpeakerImportanceScore(
  speakerId: string,
  role: SpeakerRole | null,
  talkTimeRatio: number | null,
  screenTimeRatio: number | null,
): SpeakerImportanceScore {
  const composite = averageAvailable([talkTimeRatio, screenTimeRatio]);

  return {
    speakerId,
    role,
    talkTimeRatio,
    screenTimeRatio,
    score: composite === null ? null : Math.round(composite * 100),
  };
}
