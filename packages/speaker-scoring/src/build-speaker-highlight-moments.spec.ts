import type { FaceLandmarkSample, SpeakerTimelineEntry } from '@speedora/contracts';
import { buildSpeakerHighlightMoments } from './build-speaker-highlight-moments';
import { NULL_GESTURE_FEATURES } from './test-fixtures';

function sample(t: number, trackId: number, smile: number): FaceLandmarkSample {
  return {
    t,
    blendshapes: {
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      mouthSmileLeft: smile,
      mouthSmileRight: smile,
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

const baseTimeline: SpeakerTimelineEntry[] = [
  { speaker: 'Speaker A', start: 0, end: 5, faceTrackId: 4, isActiveOnScreen: true },
];

describe('buildSpeakerHighlightMoments', () => {
  it('produces one moment per timeline entry', () => {
    const result = buildSpeakerHighlightMoments(baseTimeline, [], [], null, false, null);
    expect(result).toHaveLength(1);
    expect(result[0].speakerId).toBe('Speaker A');
    expect(result[0].start).toBe(0);
    expect(result[0].end).toBe(5);
  });

  it("scopes emotionIntensity to only this moment's own trackId and time range", () => {
    const samples = [
      sample(1, 4, 0.9), // inside the moment, matching trackId
      sample(10, 4, 0.1), // matching trackId but OUTSIDE the moment's time range
      sample(1, 9, 0.9), // inside the time range but a DIFFERENT trackId
    ];

    const result = buildSpeakerHighlightMoments(baseTimeline, samples, [], null, false, null);

    // emotionIntensity averages averageSmile (0.9, from the one in-range/
    // matching-track sample) with averageBrowActivity (0 - the fixture's
    // brow blendshapes are all zero, a real measurement, not missing data)
    // -> (0.9 + 0) / 2.
    expect(result[0].emotionIntensity).toBeCloseTo(0.45);
  });

  it('reports null emotionIntensity when no sample matches this moment at all', () => {
    const result = buildSpeakerHighlightMoments(baseTimeline, [], [], null, false, null);
    expect(result[0].emotionIntensity).toBeNull();
  });

  it('attributes gestureIntensity only when canAttributeGesture is true AND the moment has a faceTrackId', () => {
    const gestureFeatures = { ...NULL_GESTURE_FEATURES, peakConfidence: 0.6 };

    const attributed = buildSpeakerHighlightMoments(
      baseTimeline,
      [],
      [],
      gestureFeatures,
      true,
      null,
    );
    const notAttributed = buildSpeakerHighlightMoments(
      baseTimeline,
      [],
      [],
      gestureFeatures,
      false,
      null,
    );
    const noFaceTrack = buildSpeakerHighlightMoments(
      [{ speaker: 'Speaker A', start: 0, end: 5, faceTrackId: null, isActiveOnScreen: null }],
      [],
      [],
      gestureFeatures,
      true,
      null,
    );

    expect(attributed[0].gestureIntensity).toBe(0.6);
    expect(notAttributed[0].gestureIntensity).toBeNull();
    expect(noFaceTrack[0].gestureIntensity).toBeNull();
  });

  it('attaches the same clip-level hookStrength to every moment', () => {
    const twoEntries: SpeakerTimelineEntry[] = [
      { speaker: 'Speaker A', start: 0, end: 5, faceTrackId: null, isActiveOnScreen: null },
      { speaker: 'Speaker B', start: 5, end: 10, faceTrackId: null, isActiveOnScreen: null },
    ];

    const result = buildSpeakerHighlightMoments(twoEntries, [], [], null, false, 80);

    expect(result[0].hookStrength).toBe(80);
    expect(result[1].hookStrength).toBe(80);
  });

  it('computes a 0-100 score from isActiveSpeaker + hookStrength when nothing else is available', () => {
    const result = buildSpeakerHighlightMoments(baseTimeline, [], [], null, false, 100);
    // isActiveSpeaker=true -> 1, hookStrength=100 -> 1.0 -> average 1.0 -> 100.
    expect(result[0].score).toBe(100);
  });

  it('returns a null score when every scoring component is null', () => {
    const noSignal: SpeakerTimelineEntry[] = [
      { speaker: 'Speaker A', start: 0, end: 5, faceTrackId: null, isActiveOnScreen: null },
    ];
    const result = buildSpeakerHighlightMoments(noSignal, [], [], null, false, null);
    expect(result[0].score).toBeNull();
  });
});
