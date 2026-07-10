import type { FaceLandmarkSample } from '@speedora/contracts';
import type { AudioActivityWindow } from '@speedora/facial-intelligence';
import { detectActiveSpeaker } from './detect-active-speaker';

// Only t/blendshapes.jawOpen/trackId matter to this module - every other
// field is null (unused), same "minimal fixture for what THIS module
// actually reads" convention as clip-scoring's own narrow input contracts.
function sample(overrides: {
  t: number;
  jawOpen: number | null;
  trackId: number | null;
}): FaceLandmarkSample {
  return {
    t: overrides.t,
    blendshapes:
      overrides.jawOpen === null
        ? null
        : {
            eyeBlinkLeft: 0,
            eyeBlinkRight: 0,
            mouthSmileLeft: 0,
            mouthSmileRight: 0,
            jawOpen: overrides.jawOpen,
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
    trackId: overrides.trackId,
    mouthWidth: null,
  };
}

describe('detectActiveSpeaker', () => {
  it('reports the tracked face as active when mouth is open AND audio is active', () => {
    const audio: AudioActivityWindow[] = [{ start: 0, end: 10, hasAudio: true }];
    const result = detectActiveSpeaker([sample({ t: 1, jawOpen: 0.5, trackId: 3 })], audio);
    expect(result).toEqual([{ t: 1, activeTrackId: 3, confidence: 0.5 }]);
  });

  it('reports no active speaker when mouth is open but audio is silent', () => {
    const audio: AudioActivityWindow[] = [{ start: 0, end: 10, hasAudio: false }];
    const result = detectActiveSpeaker([sample({ t: 1, jawOpen: 0.5, trackId: 3 })], audio);
    expect(result).toEqual([{ t: 1, activeTrackId: null, confidence: null }]);
  });

  it('reports no active speaker when audio is active but mouth is closed', () => {
    const audio: AudioActivityWindow[] = [{ start: 0, end: 10, hasAudio: true }];
    const result = detectActiveSpeaker([sample({ t: 1, jawOpen: 0.05, trackId: 3 })], audio);
    expect(result).toEqual([{ t: 1, activeTrackId: null, confidence: null }]);
  });

  it('reports null when there is no face at all', () => {
    const audio: AudioActivityWindow[] = [{ start: 0, end: 10, hasAudio: true }];
    const result = detectActiveSpeaker([sample({ t: 1, jawOpen: null, trackId: null })], audio);
    expect(result).toEqual([{ t: 1, activeTrackId: null, confidence: null }]);
  });

  it('reports null when no audio-activity window covers this sample at all', () => {
    const result = detectActiveSpeaker([sample({ t: 1, jawOpen: 0.5, trackId: 3 })], []);
    expect(result).toEqual([{ t: 1, activeTrackId: null, confidence: null }]);
  });
});
