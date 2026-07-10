import type {
  FaceLandmarkSample,
  GestureFeatures,
  SpeakerHighlightMoment,
  SpeakerTimelineEntry,
} from '@speedora/contracts';
import {
  deriveFaceLandmarkFeatures,
  type AudioActivityWindow,
} from '@speedora/facial-intelligence';
import { averageAvailable } from './normalize';

function momentScore(moment: Omit<SpeakerHighlightMoment, 'score'>): number | null {
  const composite = averageAvailable([
    moment.isActiveSpeaker === null ? null : moment.isActiveSpeaker ? 1 : 0,
    moment.emotionIntensity,
    moment.gestureIntensity,
    moment.eyeContactRate,
    moment.hookStrength === null ? null : moment.hookStrength / 100,
  ]);
  return composite === null ? null : Math.round(composite * 100);
}

// Speaker Intelligence roadmap, Milestone C - Speaker Highlight Score. One
// moment per @speedora/speaker-diarization's speakerTimeline entry (a
// speaker turn IS the natural "moment" boundary here - no arbitrary
// re-windowing). Re-runs deriveFaceLandmarkFeatures scoped to BOTH this
// entry's own faceTrackId AND its own [start, end) time range, so a
// moment's eyeContactRate/emotionIntensity reflect only that turn, not the
// whole clip.
//
// `hookStrength` is clip-level (from clip-scoring's LLM call, which has no
// per-moment granularity) - the SAME value is attached to every moment in
// this clip, not a claim that this particular moment specifically drove
// the hook score. `canAttributeGesture` is the caller's own "is there only
// one face track in this whole clip" determination (see
// deriveClipSpeakerScores) - gesture-intelligence has no per-track
// association at all, so attributing it to a specific moment/speaker is
// only defensible when there's no ambiguity about who's on screen.
export function buildSpeakerHighlightMoments(
  timeline: SpeakerTimelineEntry[],
  faceLandmarks: FaceLandmarkSample[],
  audioActivity: AudioActivityWindow[],
  gestureFeatures: GestureFeatures | null,
  canAttributeGesture: boolean,
  hookStrength: number | null,
): SpeakerHighlightMoment[] {
  return timeline.map((entry) => {
    const samplesInMoment =
      entry.faceTrackId === null
        ? []
        : faceLandmarks.filter(
            (sample) =>
              sample.trackId === entry.faceTrackId &&
              sample.t >= entry.start &&
              sample.t < entry.end,
          );
    const momentFaceFeatures =
      samplesInMoment.length > 0
        ? deriveFaceLandmarkFeatures(samplesInMoment, audioActivity)
        : null;

    const eyeContactRate = momentFaceFeatures?.eyeContactRate ?? null;
    const emotionIntensity = averageAvailable([
      momentFaceFeatures?.averageSmile ?? null,
      momentFaceFeatures?.averageBrowActivity ?? null,
    ]);
    const gestureIntensity =
      canAttributeGesture && entry.faceTrackId !== null
        ? (gestureFeatures?.peakConfidence ?? null)
        : null;

    const moment: Omit<SpeakerHighlightMoment, 'score'> = {
      speakerId: entry.speaker,
      start: entry.start,
      end: entry.end,
      isActiveSpeaker: entry.isActiveOnScreen,
      emotionIntensity,
      gestureIntensity,
      eyeContactRate,
      hookStrength,
    };

    return { ...moment, score: momentScore(moment) };
  });
}
