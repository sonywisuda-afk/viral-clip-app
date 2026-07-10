import type { FaceLandmarkSample, SpeakerTimelineEntry } from '@speedora/contracts';
import {
  deriveClipSpeakerScores,
  type SpeakerTranscriptSegment,
} from './derive-clip-speaker-scores';

function faceSample(t: number, trackId: number): FaceLandmarkSample {
  return {
    t,
    blendshapes: {
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      mouthSmileLeft: 0.5,
      mouthSmileRight: 0.5,
      jawOpen: 0.2,
      cheekSquintLeft: 0,
      cheekSquintRight: 0,
      eyeSquintLeft: 0,
      eyeSquintRight: 0,
      browDownLeft: 0,
      browDownRight: 0,
      browInnerUp: 0,
      browOuterUpLeft: 0,
      browOuterUpRight: 0,
    },
    rotation: null,
    boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
    leftIris: null,
    rightIris: null,
    leftEyeInnerCorner: null,
    leftEyeOuterCorner: null,
    rightEyeInnerCorner: null,
    rightEyeOuterCorner: null,
    sharpness: null,
    brightness: null,
    mouthContrastRatio: null,
    faceDescriptor: null,
    trackId,
    mouthWidth: null,
  };
}

const timeline: SpeakerTimelineEntry[] = [
  { speaker: 'Speaker A', start: 0, end: 6, faceTrackId: 4, isActiveOnScreen: true },
  { speaker: 'Speaker B', start: 6, end: 10, faceTrackId: null, isActiveOnScreen: null },
];

const transcriptSegments: SpeakerTranscriptSegment[] = [
  { speaker: 'Speaker A', rmsDb: -10, peakDb: -2, speakingRateWordsPerSecond: 2 },
  { speaker: 'Speaker B', rmsDb: -30, peakDb: -20, speakingRateWordsPerSecond: 1 },
];

describe('deriveClipSpeakerScores', () => {
  it('computes talkTimeRatio per speaker from the timeline, proportional to clip duration', () => {
    const result = deriveClipSpeakerScores({
      speakerTimeline: timeline,
      faceLandmarks: [],
      audioActivity: [],
      transcriptSegments,
      gestureFeatures: null,
      clipDurationSeconds: 10,
      hookStrength: null,
    });

    expect(result.importance.find((i) => i.speakerId === 'Speaker A')?.talkTimeRatio).toBeCloseTo(
      0.6,
    );
    expect(result.importance.find((i) => i.speakerId === 'Speaker B')?.talkTimeRatio).toBeCloseTo(
      0.4,
    );
  });

  it("computes screenTimeRatio as this speaker's own trackId share of ALL faceLandmarks samples", () => {
    const faceLandmarks = [faceSample(1, 4), faceSample(2, 4), faceSample(3, 4), faceSample(4, 4)];

    const result = deriveClipSpeakerScores({
      speakerTimeline: timeline,
      faceLandmarks,
      audioActivity: [],
      transcriptSegments,
      gestureFeatures: null,
      clipDurationSeconds: 10,
      hookStrength: null,
    });

    expect(result.importance.find((i) => i.speakerId === 'Speaker A')?.screenTimeRatio).toBe(1);
    // Speaker B never appears as a matched faceTrackId at all - 0 of 4 samples.
    expect(result.importance.find((i) => i.speakerId === 'Speaker B')?.screenTimeRatio).toBe(0);
  });

  it('attributes clip-wide gestureFeatures only to the speaker with the sole face track, when exactly one track exists', () => {
    const faceLandmarks = [faceSample(1, 4)];
    const gestureFeatures = {
      dominantGesture: null,
      gestureTransitions: 0,
      peakConfidence: 0.7,
      stability: null,
    };

    const result = deriveClipSpeakerScores({
      speakerTimeline: timeline,
      faceLandmarks,
      audioActivity: [],
      transcriptSegments,
      gestureFeatures,
      clipDurationSeconds: 10,
      hookStrength: null,
    });

    expect(result.confidence.find((c) => c.speakerId === 'Speaker A')?.gestureActivity).toBe(0.7);
    expect(result.confidence.find((c) => c.speakerId === 'Speaker B')?.gestureActivity).toBeNull();
  });

  it('does not attribute gesture data to anyone when the clip has more than one distinct face track', () => {
    const faceLandmarks = [faceSample(1, 4), faceSample(2, 9)];
    const gestureFeatures = {
      dominantGesture: null,
      gestureTransitions: 0,
      peakConfidence: 0.7,
      stability: null,
    };

    const result = deriveClipSpeakerScores({
      speakerTimeline: timeline,
      faceLandmarks,
      audioActivity: [],
      transcriptSegments,
      gestureFeatures,
      clipDurationSeconds: 10,
      hookStrength: null,
    });

    expect(result.confidence.every((c) => c.gestureActivity === null)).toBe(true);
  });

  it("groups transcriptSegments by speaker to derive each speaker's OWN voice stats", () => {
    const result = deriveClipSpeakerScores({
      speakerTimeline: timeline,
      faceLandmarks: [],
      audioActivity: [],
      transcriptSegments,
      gestureFeatures: null,
      clipDurationSeconds: 10,
      hookStrength: null,
    });

    // Speaker A's segment is -10dB (loud), Speaker B's is -30dB (quiet) -
    // engagement's voiceEnergyScore should reflect each speaker's OWN
    // audio, not a clip-wide average of both.
    const engagementA = result.engagement.find((e) => e.speakerId === 'Speaker A');
    const engagementB = result.engagement.find((e) => e.speakerId === 'Speaker B');
    expect(engagementA!.voiceEnergyScore!).toBeGreaterThan(engagementB!.voiceEnergyScore!);
  });

  it('delegates highlight moment construction, producing one moment per timeline entry', () => {
    const result = deriveClipSpeakerScores({
      speakerTimeline: timeline,
      faceLandmarks: [],
      audioActivity: [],
      transcriptSegments,
      gestureFeatures: null,
      clipDurationSeconds: 10,
      hookStrength: 90,
    });

    expect(result.highlightMoments).toHaveLength(2);
    expect(result.highlightMoments.every((m) => m.hookStrength === 90)).toBe(true);
  });
});
