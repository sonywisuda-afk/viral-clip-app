import type { ActiveSpeakerSample, SpeakerFaceAssociation, SpeakerTurn } from '@speedora/contracts';

// A face trackId needs to be the active speaker for at least this fraction
// of a speaker's evaluated samples before the association is trusted enough
// to report as 'matched' rather than 'unknown' - an unvalidated guess, same
// honesty as every other threshold in this pipeline (e.g. face-tracking-
// quality.ts's STABLE_* constants).
const MIN_MATCH_CONFIDENCE = 0.5;

// Speaker Intelligence roadmap, Milestone A - Speaker-Face Association.
// Links each speaker-diarization label to the face trackId most
// consistently reported as the active speaker (see detectActiveSpeaker)
// during that speaker's own turns. `turns` and `activeSpeakerSamples` must
// already be on the SAME clip-relative timeline (the caller's
// responsibility to align diarization's absolute-video-time turns to a
// clip's own [0, duration) window - same "adapter narrows/aligns before
// calling" convention as every other module in this pipeline).
export function associateSpeakersWithFaces(
  turns: SpeakerTurn[],
  activeSpeakerSamples: ActiveSpeakerSample[],
): SpeakerFaceAssociation[] {
  const speakerLabels = [...new Set(turns.map((turn) => turn.speaker))];

  return speakerLabels.map((speaker) => {
    const speakerTurns = turns.filter((turn) => turn.speaker === speaker);
    const samplesWithinTurns = activeSpeakerSamples.filter((sample) =>
      speakerTurns.some((turn) => sample.t >= turn.start && sample.t < turn.end),
    );

    const trackCounts = new Map<number, number>();
    for (const sample of samplesWithinTurns) {
      if (sample.activeTrackId === null) continue;
      trackCounts.set(sample.activeTrackId, (trackCounts.get(sample.activeTrackId) ?? 0) + 1);
    }

    if (samplesWithinTurns.length === 0 || trackCounts.size === 0) {
      return { speaker, faceTrackId: null, status: 'unknown' as const, confidence: 0 };
    }

    let bestTrackId = -1;
    let bestCount = 0;
    for (const [trackId, count] of trackCounts) {
      if (count > bestCount) {
        bestTrackId = trackId;
        bestCount = count;
      }
    }
    const confidence = bestCount / samplesWithinTurns.length;

    return confidence >= MIN_MATCH_CONFIDENCE
      ? { speaker, faceTrackId: bestTrackId, status: 'matched' as const, confidence }
      : { speaker, faceTrackId: null, status: 'unknown' as const, confidence };
  });
}
