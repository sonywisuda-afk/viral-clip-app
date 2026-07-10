import type {
  ActiveSpeakerSample,
  SpeakerFaceAssociation,
  SpeakerTimelineEntry,
  SpeakerTimelineFeatures,
  SpeakerTransition,
  SpeakerTurn,
} from '@speedora/contracts';

// Speaker Intelligence roadmap, Milestone B - Speaker Timeline. Fuses
// diarization's turns with @speedora/active-speaker-intelligence's
// per-clip output (associateSpeakersWithFaces/detectActiveSpeaker) into one
// unified structure. All three inputs must already be on the SAME
// timeline (this pipeline runs it per-clip, clip-relative - see
// render-clip.worker.ts's toSpeakerTurns/toAudioActivityWindows for the
// same alignment convention every other module here follows).
//
// `isActiveOnScreen` is null (not false) when there's no face-association
// data to check against at all - matching this speaker to a face failed
// or wasn't attempted, which is a genuinely different situation from
// "matched to a face, but that face wasn't shown as speaking during this
// turn".
export function buildSpeakerTimeline(
  turns: SpeakerTurn[],
  faceAssociations: SpeakerFaceAssociation[],
  activeSpeakerSamples: ActiveSpeakerSample[],
): SpeakerTimelineEntry[] {
  const sorted = [...turns].sort((a, b) => a.start - b.start);

  return sorted.map((turn) => {
    const association = faceAssociations.find(
      (candidate) => candidate.speaker === turn.speaker && candidate.status === 'matched',
    );
    const faceTrackId = association?.faceTrackId ?? null;

    let isActiveOnScreen: boolean | null = null;
    if (faceTrackId !== null) {
      const samplesWithinTurn = activeSpeakerSamples.filter(
        (sample) => sample.t >= turn.start && sample.t < turn.end,
      );
      if (samplesWithinTurn.length > 0) {
        isActiveOnScreen = samplesWithinTurn.some((sample) => sample.activeTrackId === faceTrackId);
      }
    }

    return {
      speaker: turn.speaker,
      start: turn.start,
      end: turn.end,
      faceTrackId,
      isActiveOnScreen,
    };
  });
}

// Speaker Intelligence roadmap, Milestone B - Speaker Transition Detection.
// One marker per point where the (sorted-by-start) turn sequence's speaker
// actually changes - NOT one marker per turn (consecutive turns CAN share
// a speaker, e.g. after a brief pyannote-detected sub-turn split within the
// same person's speech).
export function detectSpeakerTransitions(turns: SpeakerTurn[]): SpeakerTimelineFeatures {
  const sorted = [...turns].sort((a, b) => a.start - b.start);

  const transitions: SpeakerTransition[] = [];
  let previousSpeaker: string | null = null;
  for (const turn of sorted) {
    if (turn.speaker !== previousSpeaker) {
      transitions.push({ t: turn.start, fromSpeaker: previousSpeaker, toSpeaker: turn.speaker });
      previousSpeaker = turn.speaker;
    }
  }

  return { transitions, transitionCount: transitions.length };
}
