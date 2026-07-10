import type { FaceLandmarkSample } from '@speedora/contracts';
import {
  deriveFaceLandmarkFeatures,
  type AudioActivityWindow,
} from './derive-face-landmark-features';

const EMPTY_SAMPLE: FaceLandmarkSample = {
  t: 0,
  blendshapes: null,
  rotation: null,
  boundingBox: null,
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
  trackId: null,
  mouthWidth: null,
};

// Eye landmarks default to a symmetric, dead-centered iris in each eye
// socket (both eyes' offset = 0) - "looking straight at the camera" -
// combined with rotation: {pitch:0, yaw:0, roll:0} below, this resolves to
// lookingDirection 'center' by default so tests that don't care about
// Batch 2 (Eye Contact/Looking Direction) aren't affected by it.
// sharpness/brightness/mouthContrastRatio (Batch 3) default to
// unambiguously "sharp, well-lit, no occlusion" values so tests that don't
// care about Batch 3 aren't affected by it either.
function sampleWithFace(overrides: Partial<FaceLandmarkSample> = {}): FaceLandmarkSample {
  return {
    ...EMPTY_SAMPLE,
    boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
    blendshapes: {
      eyeBlinkLeft: 0.1,
      eyeBlinkRight: 0.1,
      mouthSmileLeft: 0.5,
      mouthSmileRight: 0.5,
      jawOpen: 0.2,
      // Batch 5B - default to "not squinting/raising" so tests that don't
      // care about Batch 5B (genuineSmileRate etc.) aren't affected by it.
      cheekSquintLeft: 0,
      cheekSquintRight: 0,
      eyeSquintLeft: 0,
      eyeSquintRight: 0,
      // Batch 5D - default to "still eyebrows" so tests that don't care
      // about Batch 5D (dominantAffect etc.) aren't affected by it.
      browDownLeft: 0,
      browDownRight: 0,
      browInnerUp: 0,
      browOuterUpLeft: 0,
      browOuterUpRight: 0,
    },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    leftEyeInnerCorner: { x: 0.47, y: 0.5, z: 0 },
    leftEyeOuterCorner: { x: 0.4, y: 0.5, z: 0 },
    leftIris: { x: 0.435, y: 0.5, z: 0 },
    rightEyeInnerCorner: { x: 0.53, y: 0.5, z: 0 },
    rightEyeOuterCorner: { x: 0.6, y: 0.5, z: 0 },
    rightIris: { x: 0.565, y: 0.5, z: 0 },
    sharpness: 300,
    brightness: 128,
    mouthContrastRatio: 1,
    // Batch 4 - a fixed, arbitrary track id so tests that don't care about
    // tracking (everything before the "speaker tracking" describe block)
    // see one single, consistent "same person throughout" track by default.
    faceDescriptor: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    trackId: 0,
    // Batch 5B - an arbitrary "normal, relaxed" mouth width ratio.
    mouthWidth: 0.5,
    ...overrides,
  };
}

// Batch 5B - a full FaceBlendshapes literal with every field explicit,
// used by tests that override individual blendshape scores (unlike
// sampleWithFace's own overrides, which replace the WHOLE blendshapes
// object rather than merging into it).
function blendshapesWith(overrides: Partial<FaceLandmarkSample['blendshapes']> = {}) {
  return {
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    mouthSmileLeft: 0,
    mouthSmileRight: 0,
    jawOpen: 0,
    cheekSquintLeft: 0,
    cheekSquintRight: 0,
    eyeSquintLeft: 0,
    eyeSquintRight: 0,
    browDownLeft: 0,
    browDownRight: 0,
    browInnerUp: 0,
    browOuterUpLeft: 0,
    browOuterUpRight: 0,
    ...overrides,
  };
}

describe('deriveFaceLandmarkFeatures', () => {
  it('returns all-null features (including visibilityScore) when there are no samples at all', () => {
    expect(deriveFaceLandmarkFeatures([])).toEqual({
      blinkRate: null,
      averageSmile: null,
      averageMouthOpen: null,
      averageAbsoluteYaw: null,
      averageAbsolutePitch: null,
      positionScore: null,
      sizeScore: null,
      visibilityScore: null,
      eyeContactRate: null,
      dominantLookingDirection: null,
      averageSharpness: null,
      averageBrightness: null,
      occlusionRate: null,
      speakerChangeCount: null,
      dominantSpeakerConsistency: null,
      speakerAudioSyncRate: null,
      averageLipVelocity: null,
      speakingIntensity: null,
      pauseCount: null,
      articulationRate: null,
      averageMouthWidth: null,
      averageCheekRaise: null,
      averageEyeSquint: null,
      genuineSmileRate: null,
      blinkFrequencyPerMinute: null,
      prolongedClosureCount: null,
      gazeStabilityScore: null,
      averageBrowActivity: null,
      averageHeadMovementRate: null,
      dominantAffect: null,
      affectConfidence: null,
    });
  });

  it('returns null features but visibilityScore 0 when no sample ever found a face', () => {
    const result = deriveFaceLandmarkFeatures([EMPTY_SAMPLE, EMPTY_SAMPLE]);
    expect(result).toEqual({
      blinkRate: null,
      averageSmile: null,
      averageMouthOpen: null,
      averageAbsoluteYaw: null,
      averageAbsolutePitch: null,
      positionScore: null,
      sizeScore: null,
      visibilityScore: 0,
      eyeContactRate: null,
      dominantLookingDirection: null,
      averageSharpness: null,
      averageBrightness: null,
      occlusionRate: null,
      speakerChangeCount: null,
      dominantSpeakerConsistency: null,
      speakerAudioSyncRate: null,
      averageLipVelocity: null,
      speakingIntensity: null,
      pauseCount: null,
      articulationRate: null,
      averageMouthWidth: null,
      averageCheekRaise: null,
      averageEyeSquint: null,
      genuineSmileRate: null,
      blinkFrequencyPerMinute: null,
      prolongedClosureCount: null,
      gazeStabilityScore: null,
      averageBrowActivity: null,
      averageHeadMovementRate: null,
      dominantAffect: null,
      affectConfidence: null,
    });
  });

  it('computes visibilityScore as the fraction of ALL samples with a detected face', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace(),
      EMPTY_SAMPLE,
      sampleWithFace(),
      EMPTY_SAMPLE,
    ]);
    expect(result.visibilityScore).toBe(0.5);
  });

  it('computes blinkRate as the fraction of blendshape samples crossing the blink threshold', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace({ blendshapes: blendshapesWith({ eyeBlinkLeft: 0.8, eyeBlinkRight: 0.1 }) }),
      sampleWithFace({ blendshapes: blendshapesWith({ eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1 }) }),
    ]);
    // Only the first sample crosses 0.5 on either eye (max(0.8, 0.1) = 0.8).
    expect(result.blinkRate).toBe(0.5);
  });

  it('averages both mouthSmile blendshapes for averageSmile', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace({ blendshapes: blendshapesWith({ mouthSmileLeft: 0.6, mouthSmileRight: 0.8 }) }),
    ]);
    expect(result.averageSmile).toBeCloseTo(0.7);
  });

  it('averages jawOpen for averageMouthOpen', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace({ blendshapes: blendshapesWith({ jawOpen: 0.4 }) }),
      sampleWithFace({ blendshapes: blendshapesWith({ jawOpen: 0.6 }) }),
    ]);
    expect(result.averageMouthOpen).toBeCloseTo(0.5);
  });

  it('averages the ABSOLUTE value of yaw/pitch - a speaker turning consistently left and one turning consistently right score the same', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace({ rotation: { pitch: -10, yaw: -20, roll: 0 } }),
      sampleWithFace({ rotation: { pitch: 10, yaw: 20, roll: 0 } }),
    ]);
    expect(result.averageAbsoluteYaw).toBe(20);
    expect(result.averageAbsolutePitch).toBe(10);
  });

  it('gives positionScore 1 for a perfectly centered face', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace({ boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 } }),
    ]);
    expect(result.positionScore).toBe(1);
  });

  it('gives a lower positionScore for a face near the frame edge', () => {
    const centered = deriveFaceLandmarkFeatures([
      sampleWithFace({ boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.2 } }),
    ]);
    const offCenter = deriveFaceLandmarkFeatures([
      sampleWithFace({ boundingBox: { xCenter: 0.1, yCenter: 0.1, width: 0.2, height: 0.2 } }),
    ]);
    expect(offCenter.positionScore!).toBeLessThan(centered.positionScore!);
  });

  it('computes sizeScore as the bounding box area (width * height)', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace({ boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.4, height: 0.5 } }),
    ]);
    expect(result.sizeScore).toBeCloseTo(0.2);
  });

  it('leaves blendshape/rotation-derived features null for a sample with a face but no blendshapes/rotation, while still computing position/size/visibility', () => {
    const result = deriveFaceLandmarkFeatures([
      sampleWithFace({ blendshapes: null, rotation: null }),
    ]);
    expect(result.blinkRate).toBeNull();
    expect(result.averageSmile).toBeNull();
    expect(result.averageMouthOpen).toBeNull();
    expect(result.averageAbsoluteYaw).toBeNull();
    expect(result.averageAbsolutePitch).toBeNull();
    expect(result.positionScore).toBe(1);
    expect(result.sizeScore).toBeCloseTo(0.12);
    expect(result.visibilityScore).toBe(1);
    expect(result.eyeContactRate).toBeNull();
    expect(result.dominantLookingDirection).toBeNull();
  });

  describe('eye contact / looking direction (Batch 2)', () => {
    it('resolves to center (eye contact) when the head is forward-facing and both irises are centered', () => {
      const result = deriveFaceLandmarkFeatures([sampleWithFace()]);
      expect(result.dominantLookingDirection).toBe('center');
      expect(result.eyeContactRate).toBe(1);
    });

    it('resolves to right/left from head yaw BEFORE iris position, once yaw exceeds the forward threshold', () => {
      const right = deriveFaceLandmarkFeatures([
        sampleWithFace({ rotation: { pitch: 0, yaw: 25, roll: 0 } }),
      ]);
      expect(right.dominantLookingDirection).toBe('right');
      expect(right.eyeContactRate).toBe(0);

      const left = deriveFaceLandmarkFeatures([
        sampleWithFace({ rotation: { pitch: 0, yaw: -25, roll: 0 } }),
      ]);
      expect(left.dominantLookingDirection).toBe('left');
    });

    it('resolves to up/down from head pitch when yaw is forward-facing but pitch exceeds the threshold', () => {
      const down = deriveFaceLandmarkFeatures([
        sampleWithFace({ rotation: { pitch: 25, yaw: 0, roll: 0 } }),
      ]);
      expect(down.dominantLookingDirection).toBe('down');

      const up = deriveFaceLandmarkFeatures([
        sampleWithFace({ rotation: { pitch: -25, yaw: 0, roll: 0 } }),
      ]);
      expect(up.dominantLookingDirection).toBe('up');
    });

    it('falls back to iris gaze offset for left/right when the head itself is forward-facing', () => {
      // Both irises shifted toward higher x (the frame-right side) - for
      // the LEFT eye that's toward its INNER corner (0.47, the higher-x
      // side of that socket); for the RIGHT eye that's toward its OUTER
      // corner (0.6) - "outer"/"inner" point in opposite frame-directions
      // per eye, only x-direction is consistent across both. Head stays at
      // rotation:{0,0,0} (forward-facing, from the default), only iris
      // position moves.
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          leftIris: { x: 0.46, y: 0.5, z: 0 },
          rightIris: { x: 0.595, y: 0.5, z: 0 },
        }),
      ]);
      // Both eyes shifted toward higher x (the frame-right side) - image-
      // space x increasing is 'right', same convention head yaw uses.
      expect(result.dominantLookingDirection).toBe('right');
    });

    it('computes eyeContactRate as the fraction of samples resolved to center', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace(), // center
        sampleWithFace({ rotation: { pitch: 0, yaw: 25, roll: 0 } }), // right
      ]);
      expect(result.eyeContactRate).toBe(0.5);
    });

    it('excludes a sample missing eye-corner/iris landmarks from the looking-direction tally entirely', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ leftIris: null }),
        sampleWithFace({ rotation: { pitch: 0, yaw: 25, roll: 0 } }),
      ]);
      // Only the second sample ('right') is eligible - the first is excluded
      // (null, not counted as either 'center' or a denominator entry).
      expect(result.dominantLookingDirection).toBe('right');
      expect(result.eyeContactRate).toBe(0);
    });
  });

  describe('image quality / occlusion (Batch 3)', () => {
    it('averages sharpness and brightness across samples with a face', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ sharpness: 200, brightness: 100 }),
        sampleWithFace({ sharpness: 400, brightness: 150 }),
      ]);
      expect(result.averageSharpness).toBe(300);
      expect(result.averageBrightness).toBe(125);
    });

    it('computes occlusionRate as the fraction of samples below the contrast threshold', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ mouthContrastRatio: 0.05 }), // below threshold - "occluded"
        sampleWithFace({ mouthContrastRatio: 0.8 }), // above threshold - clear
      ]);
      expect(result.occlusionRate).toBe(0.5);
    });

    it('does not flag a naturally still/closed mouth at exactly the threshold as occluded (strict less-than)', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ mouthContrastRatio: 0.15 }),
      ]);
      expect(result.occlusionRate).toBe(0);
    });

    it('leaves averageSharpness/averageBrightness/occlusionRate null when no sample has that measurement', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ sharpness: null, brightness: null, mouthContrastRatio: null }),
      ]);
      expect(result.averageSharpness).toBeNull();
      expect(result.averageBrightness).toBeNull();
      expect(result.occlusionRate).toBeNull();
    });
  });

  describe('face re-identification / tracking / speaker face selection (Batch 4)', () => {
    it('counts speakerChangeCount as the number of transitions between consecutive trackIds', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ trackId: 0 }),
        sampleWithFace({ trackId: 0 }),
        sampleWithFace({ trackId: 1 }),
        sampleWithFace({ trackId: 0 }),
      ]);
      expect(result.speakerChangeCount).toBe(2);
    });

    it('gives speakerChangeCount 0 and dominantSpeakerConsistency 1 for a single unbroken track', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ trackId: 7 }),
        sampleWithFace({ trackId: 7 }),
        sampleWithFace({ trackId: 7 }),
      ]);
      expect(result.speakerChangeCount).toBe(0);
      expect(result.dominantSpeakerConsistency).toBe(1);
    });

    it('scores dominantSpeakerConsistency by the LONGEST RUN, not the highest overall count', () => {
      // track 0 appears 3 times total but in two separate bursts (longest
      // run = 2); track 1 appears in one unbroken run of 2 - the longest
      // contiguous run in the whole sequence is track 0's first burst or
      // track 1's run, both length 2, out of 5 samples total.
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ trackId: 0 }),
        sampleWithFace({ trackId: 0 }),
        sampleWithFace({ trackId: 1 }),
        sampleWithFace({ trackId: 1 }),
        sampleWithFace({ trackId: 0 }),
      ]);
      expect(result.dominantSpeakerConsistency).toBeCloseTo(2 / 5);
    });

    it('excludes samples with a face but no trackId from the tracking tally', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ trackId: null }),
        sampleWithFace({ trackId: 3 }),
      ]);
      expect(result.speakerChangeCount).toBe(0);
      expect(result.dominantSpeakerConsistency).toBe(1);
    });

    it('leaves speakerAudioSyncRate null when no audio-timing data is supplied at all (not merely inconclusive)', () => {
      const result = deriveFaceLandmarkFeatures([sampleWithFace()]);
      expect(result.speakerAudioSyncRate).toBeNull();
    });

    it('computes speakerAudioSyncRate as the fraction of samples where jawOpen agrees with audio presence', () => {
      const audioActivity: AudioActivityWindow[] = [
        { start: 0, end: 1, hasAudio: true },
        { start: 1, end: 2, hasAudio: false },
      ];
      const result = deriveFaceLandmarkFeatures(
        [
          sampleWithFace({
            t: 0.5,
            // mouth active, audio present - agrees
            blendshapes: blendshapesWith({ jawOpen: 0.5 }),
          }),
          sampleWithFace({
            t: 1.5,
            // mouth active, but audio absent - disagrees
            blendshapes: blendshapesWith({ jawOpen: 0.5 }),
          }),
        ],
        audioActivity,
      );
      expect(result.speakerAudioSyncRate).toBe(0.5);
    });

    it('excludes samples whose timestamp falls outside every supplied audio-activity window', () => {
      const audioActivity: AudioActivityWindow[] = [{ start: 0, end: 1, hasAudio: true }];
      const result = deriveFaceLandmarkFeatures(
        [
          sampleWithFace({
            t: 5, // outside the only supplied window
            blendshapes: blendshapesWith(),
          }),
        ],
        audioActivity,
      );
      expect(result.speakerAudioSyncRate).toBeNull();
    });
  });

  describe('lip activity (Batch 5A)', () => {
    function withJawOpen(t: number, jawOpen: number) {
      return sampleWithFace({ t, blendshapes: blendshapesWith({ jawOpen }) });
    }

    it('computes averageLipVelocity as the average |delta jawOpen| per second between consecutive samples', () => {
      const result = deriveFaceLandmarkFeatures([
        withJawOpen(0, 0.1),
        withJawOpen(1, 0.3),
        withJawOpen(2, 0.1),
      ]);
      expect(result.averageLipVelocity).toBeCloseTo(0.2);
    });

    it('divides by the actual elapsed time, not an assumed 1-second gap', () => {
      const result = deriveFaceLandmarkFeatures([withJawOpen(0, 0.1), withJawOpen(2, 0.5)]);
      // delta 0.4 over 2 seconds = 0.2/sec, not 0.4/sec.
      expect(result.averageLipVelocity).toBeCloseTo(0.2);
    });

    it('leaves averageLipVelocity null with fewer than 2 samples-with-blendshapes', () => {
      const result = deriveFaceLandmarkFeatures([withJawOpen(0, 0.5)]);
      expect(result.averageLipVelocity).toBeNull();
    });

    it('computes speakingIntensity as the average jawOpen among only the "active" (above-threshold) samples', () => {
      const result = deriveFaceLandmarkFeatures([
        withJawOpen(0, 0.05), // inactive, excluded
        withJawOpen(1, 0.4),
        withJawOpen(2, 0.6),
      ]);
      expect(result.speakingIntensity).toBeCloseTo(0.5);
    });

    it('leaves speakingIntensity null when no sample ever crosses the activity threshold', () => {
      const result = deriveFaceLandmarkFeatures([withJawOpen(0, 0.05), withJawOpen(1, 0.1)]);
      expect(result.speakingIntensity).toBeNull();
    });

    it('counts a sustained run of low-activity samples as one pause', () => {
      const result = deriveFaceLandmarkFeatures([
        withJawOpen(0, 0.5), // active
        withJawOpen(1, 0.05), // pause starts
        withJawOpen(2, 0.05),
        withJawOpen(3, 0.05), // pause ends (3 low samples >= MIN_PAUSE_SAMPLES)
        withJawOpen(4, 0.5), // active again
      ]);
      expect(result.pauseCount).toBe(1);
    });

    it('does not count a single low-activity blip (below MIN_PAUSE_SAMPLES) as a pause', () => {
      const result = deriveFaceLandmarkFeatures([
        withJawOpen(0, 0.5),
        withJawOpen(1, 0.05),
        withJawOpen(2, 0.5),
      ]);
      expect(result.pauseCount).toBe(0);
    });

    it('counts a trailing low-activity run that never resumes as a pause too', () => {
      const result = deriveFaceLandmarkFeatures([
        withJawOpen(0, 0.5),
        withJawOpen(1, 0.05),
        withJawOpen(2, 0.05),
      ]);
      expect(result.pauseCount).toBe(1);
    });

    it('computes articulationRate as direction reversals in jawOpen per elapsed second', () => {
      const result = deriveFaceLandmarkFeatures([
        withJawOpen(0, 0.1),
        withJawOpen(1, 0.3), // up
        withJawOpen(2, 0.1), // down - reversal 1
        withJawOpen(3, 0.3), // up - reversal 2
      ]);
      expect(result.articulationRate).toBeCloseTo(2 / 3);
    });

    it('does not count a flat (zero-delta) step as a direction reversal', () => {
      const result = deriveFaceLandmarkFeatures([
        withJawOpen(0, 0.1),
        withJawOpen(1, 0.3),
        withJawOpen(2, 0.3), // flat - ignored, previous direction carries through
        withJawOpen(3, 0.1), // down - one reversal
      ]);
      expect(result.articulationRate).toBeCloseTo(1 / 3);
    });

    it('leaves articulationRate null with fewer than 3 samples-with-blendshapes', () => {
      const result = deriveFaceLandmarkFeatures([withJawOpen(0, 0.1), withJawOpen(1, 0.3)]);
      expect(result.articulationRate).toBeNull();
    });
  });

  describe('smile & laugh (Batch 5B)', () => {
    it('averages mouthWidth across samples that have the measurement', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ mouthWidth: 0.4 }),
        sampleWithFace({ mouthWidth: 0.6 }),
      ]);
      expect(result.averageMouthWidth).toBeCloseTo(0.5);
    });

    it('leaves averageMouthWidth null when no sample has the measurement', () => {
      const result = deriveFaceLandmarkFeatures([sampleWithFace({ mouthWidth: null })]);
      expect(result.averageMouthWidth).toBeNull();
    });

    it('averages both cheekSquint blendshapes for averageCheekRaise and both eyeSquint blendshapes for averageEyeSquint', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({ cheekSquintLeft: 0.4, cheekSquintRight: 0.6, eyeSquintLeft: 0.2, eyeSquintRight: 0.8 }),
        }),
      ]);
      expect(result.averageCheekRaise).toBeCloseTo(0.5);
      expect(result.averageEyeSquint).toBeCloseTo(0.5);
    });

    it('leaves genuineSmileRate null when no sample ever crosses the smiling threshold', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({ mouthSmileLeft: 0.1, mouthSmileRight: 0.1 }),
        }),
      ]);
      expect(result.genuineSmileRate).toBeNull();
    });

    it('counts a smiling sample as "genuine" only when cheek-raise AND eye-squint both cross their own thresholds', () => {
      const genuine = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({
            mouthSmileLeft: 0.8,
            mouthSmileRight: 0.8,
            cheekSquintLeft: 0.5,
            cheekSquintRight: 0.5,
            eyeSquintLeft: 0.5,
            eyeSquintRight: 0.5,
          }),
        }),
      ]);
      expect(genuine.genuineSmileRate).toBe(1);

      const posed = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({
            mouthSmileLeft: 0.8,
            mouthSmileRight: 0.8,
            // smiling, but no cheek-raise/eye-squint - a posed, not genuine, smile.
            cheekSquintLeft: 0,
            cheekSquintRight: 0,
            eyeSquintLeft: 0,
            eyeSquintRight: 0,
          }),
        }),
      ]);
      expect(posed.genuineSmileRate).toBe(0);
    });

    it('excludes non-smiling samples from the genuineSmileRate denominator entirely', () => {
      const result = deriveFaceLandmarkFeatures([
        // Not smiling at all - excluded from the tally, not counted as "not genuine".
        sampleWithFace({ blendshapes: blendshapesWith({ mouthSmileLeft: 0, mouthSmileRight: 0 }) }),
        sampleWithFace({
          blendshapes: blendshapesWith({
            mouthSmileLeft: 0.8,
            mouthSmileRight: 0.8,
            cheekSquintLeft: 0.5,
            cheekSquintRight: 0.5,
            eyeSquintLeft: 0.5,
            eyeSquintRight: 0.5,
          }),
        }),
      ]);
      expect(result.genuineSmileRate).toBe(1);
    });
  });

  describe('blink & eye behavior (Batch 5C)', () => {
    function withBlink(t: number, blinking: boolean) {
      return sampleWithFace({
        t,
        blendshapes: blendshapesWith({
          eyeBlinkLeft: blinking ? 0.9 : 0.1,
          eyeBlinkRight: blinking ? 0.9 : 0.1,
        }),
      });
    }

    // Default sampleWithFace() eye landmarks put both eyes' continuous
    // gaze offset at exactly 0 (iris dead-centered) - offsetting by a
    // fraction of the (fixed, 0.035) half-eye-width lets tests move the
    // gaze without needing to also fix up the corner landmarks.
    function withGazeOffset(t: number, offset: number) {
      return sampleWithFace({
        t,
        leftIris: { x: 0.435 + offset * 0.035, y: 0.5, z: 0 },
        rightIris: { x: 0.565 + offset * 0.035, y: 0.5, z: 0 },
      });
    }

    it('counts 2 separate single-sample blinks over a 60-second span as 2 blinks/minute', () => {
      const result = deriveFaceLandmarkFeatures([
        withBlink(0, true),
        withBlink(30, false),
        withBlink(60, true),
      ]);
      expect(result.blinkFrequencyPerMinute).toBeCloseTo(2);
    });

    it('leaves blinkFrequencyPerMinute null with fewer than 2 samples-with-blendshapes', () => {
      const result = deriveFaceLandmarkFeatures([withBlink(0, true)]);
      expect(result.blinkFrequencyPerMinute).toBeNull();
    });

    it('does not count a single-sample blink as a prolonged closure', () => {
      const result = deriveFaceLandmarkFeatures([
        withBlink(0, true),
        withBlink(1, false),
      ]);
      expect(result.prolongedClosureCount).toBe(0);
    });

    it('counts a run of >= PROLONGED_CLOSURE_MIN_SAMPLES consecutive blink samples as one prolonged closure', () => {
      const result = deriveFaceLandmarkFeatures([
        withBlink(0, true), // single blink, not prolonged
        withBlink(1, false),
        withBlink(2, true), // prolonged run starts
        withBlink(3, true), // prolonged run continues
        withBlink(4, false),
      ]);
      expect(result.prolongedClosureCount).toBe(1);
    });

    it('counts a trailing prolonged-closure run that never reopens', () => {
      const result = deriveFaceLandmarkFeatures([
        withBlink(0, false),
        withBlink(1, true),
        withBlink(2, true),
      ]);
      expect(result.prolongedClosureCount).toBe(1);
    });

    it('gives gazeStabilityScore 1 for a perfectly steady gaze', () => {
      const result = deriveFaceLandmarkFeatures([
        withGazeOffset(0, 0.2),
        withGazeOffset(1, 0.2),
        withGazeOffset(2, 0.2),
      ]);
      expect(result.gazeStabilityScore).toBe(1);
    });

    it('gives a lower gazeStabilityScore for a gaze that swings between samples', () => {
      const result = deriveFaceLandmarkFeatures([
        withGazeOffset(0, 0),
        withGazeOffset(1, 0.5),
      ]);
      expect(result.gazeStabilityScore).toBe(0);
    });

    it('leaves gazeStabilityScore null with fewer than 2 samples that have gaze data', () => {
      const result = deriveFaceLandmarkFeatures([withGazeOffset(0, 0.2)]);
      expect(result.gazeStabilityScore).toBeNull();
    });

    it('excludes samples missing iris/eye-corner landmarks from the gaze-stability tally', () => {
      const result = deriveFaceLandmarkFeatures([
        withGazeOffset(0, 0.2),
        sampleWithFace({ t: 1, leftIris: null, rightIris: null }),
        withGazeOffset(2, 0.2),
      ]);
      expect(result.gazeStabilityScore).toBe(1);
    });
  });

  describe('emotion heuristic (Batch 5D)', () => {
    it('averages all 5 eyebrow blendshapes (undirected) for averageBrowActivity', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({
            browDownLeft: 0.2,
            browDownRight: 0.4,
            browInnerUp: 0.6,
            browOuterUpLeft: 0.8,
            browOuterUpRight: 1.0,
          }),
        }),
      ]);
      expect(result.averageBrowActivity).toBeCloseTo(0.6);
    });

    it('computes averageHeadMovementRate from combined pitch/yaw/roll change per second', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ t: 0, rotation: { pitch: 0, yaw: 0, roll: 0 } }),
        sampleWithFace({ t: 1, rotation: { pitch: 3, yaw: 4, roll: 0 } }),
      ]);
      // 3-4-5 triangle: sqrt(3^2 + 4^2) = 5 degrees over 1 second.
      expect(result.averageHeadMovementRate).toBeCloseTo(5);
    });

    it('resolves to "positive_affect" when averageSmile alone crosses its threshold, regardless of other signals', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8 }),
        }),
      ]);
      expect(result.dominantAffect).toBe('positive_affect');
    });

    it('resolves to "high_energy" when smile is low but energy (speaking + brow) is high', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({
            mouthSmileLeft: 0,
            mouthSmileRight: 0,
            jawOpen: 0.9,
            browDownLeft: 0.8,
            browDownRight: 0.8,
            browInnerUp: 0.8,
            browOuterUpLeft: 0.8,
            browOuterUpRight: 0.8,
          }),
        }),
      ]);
      expect(result.dominantAffect).toBe('high_energy');
    });

    it('resolves to "expressive" when energy is low but mouth movement varies a lot (articulation + lip velocity)', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ t: 0, blendshapes: blendshapesWith({ jawOpen: 0 }) }),
        sampleWithFace({ t: 0.1, blendshapes: blendshapesWith({ jawOpen: 0.14 }) }),
        sampleWithFace({ t: 0.2, blendshapes: blendshapesWith({ jawOpen: 0 }) }),
        sampleWithFace({ t: 0.3, blendshapes: blendshapesWith({ jawOpen: 0.14 }) }),
        sampleWithFace({ t: 0.4, blendshapes: blendshapesWith({ jawOpen: 0 }) }),
      ]);
      expect(result.dominantAffect).toBe('expressive');
    });

    it('resolves to "low_energy" when energy is available and low, and nothing else matched', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({
            mouthSmileLeft: 0,
            mouthSmileRight: 0,
            jawOpen: 0, // inactive - speakingIntensity stays null, excluded
            browDownLeft: 0.1,
            browDownRight: 0.1,
            browInnerUp: 0.1,
            browOuterUpLeft: 0.1,
            browOuterUpRight: 0.1,
          }),
        }),
      ]);
      expect(result.dominantAffect).toBe('low_energy');
    });

    it('resolves to "neutral" when data is present but nothing crosses any threshold', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({
          blendshapes: blendshapesWith({
            mouthSmileLeft: 0.3,
            mouthSmileRight: 0.3,
            jawOpen: 0.2,
            browDownLeft: 0.4,
            browDownRight: 0.4,
            browInnerUp: 0.4,
            browOuterUpLeft: 0.4,
            browOuterUpRight: 0.4,
          }),
        }),
      ]);
      expect(result.dominantAffect).toBe('neutral');
    });

    it('leaves dominantAffect/affectConfidence null when none of the 3 component scores have any data', () => {
      const result = deriveFaceLandmarkFeatures([
        sampleWithFace({ blendshapes: null, rotation: null }),
      ]);
      expect(result.dominantAffect).toBeNull();
      expect(result.affectConfidence).toBeNull();
    });

    it('sets affectConfidence to the fraction of the 3 component scores that had data', () => {
      // Only positivityScore (averageSmile) is available here - rotation
      // is null (no head-movement component) and this is a single sample
      // (no articulation/lip-velocity component), but browActivity IS
      // available (0), so energy/expressiveness both resolve too (not
      // null) - all 3 components end up available.
      const result = deriveFaceLandmarkFeatures([sampleWithFace()]);
      expect(result.affectConfidence).toBe(1);
    });
  });
});
