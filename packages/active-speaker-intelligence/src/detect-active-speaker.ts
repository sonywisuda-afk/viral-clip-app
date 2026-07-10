import type { ActiveSpeakerSample } from '@speedora/contracts';
import type { AudioActivityWindow, FaceLandmarkSample } from '@speedora/facial-intelligence';
import { audioActiveAt, MOUTH_ACTIVITY_THRESHOLD } from './mouth-activity';

// Speaker Intelligence roadmap, Milestone A - Active Speaker Detection.
// Pure aggregation, no new subprocess: for each face-landmark sample that
// has both mouth-movement data (blendshapes) AND a resolvable audio-
// activity reading at that instant, the currently-tracked face is called
// the "active speaker" only when BOTH agree (mouth is actively moving AND
// there's concurrent speech audio). `confidence` is jawOpen itself (already
// 0-1) when the sample is called active - a proxy for how decisively the
// mouth was open, not a statistical probability, same honesty as every
// other confidence-shaped number in this pipeline.
//
// IMPORTANT LIMITATION (see docs/ai/speaker-intelligence.md): the upstream
// face-landmark detector is SINGLE-OBJECT - it only ever tracks the one
// most-prominent face per frame, never multiple simultaneous faces. This
// function therefore answers "is the one currently-tracked face actively
// speaking right now" (a genuinely useful per-instant upgrade over
// speakerAudioSyncRate's single clip-wide rate), NOT "which of several
// visible faces is speaking" - real multi-face active-speaker selection
// would need the upstream detector to track more than one face at once,
// which it doesn't today.
export function detectActiveSpeaker(
  samples: FaceLandmarkSample[],
  audioActivity: AudioActivityWindow[],
): ActiveSpeakerSample[] {
  return samples.map((sample) => {
    if (sample.blendshapes === null || sample.trackId === null) {
      return { t: sample.t, activeTrackId: null, confidence: null };
    }

    const hasAudio = audioActiveAt(audioActivity, sample.t);
    if (hasAudio === null) {
      return { t: sample.t, activeTrackId: null, confidence: null };
    }

    const mouthActive = sample.blendshapes.jawOpen >= MOUTH_ACTIVITY_THRESHOLD;
    if (mouthActive && hasAudio) {
      return { t: sample.t, activeTrackId: sample.trackId, confidence: sample.blendshapes.jawOpen };
    }
    return { t: sample.t, activeTrackId: null, confidence: null };
  });
}
