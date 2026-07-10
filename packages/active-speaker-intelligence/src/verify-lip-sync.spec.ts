import type { FaceLandmarkSample } from '@speedora/contracts';
import type { AudioActivityWindow } from '@speedora/facial-intelligence';
import { verifyLipSync } from './verify-lip-sync';

function sample(t: number, jawOpen: number, trackId: number): FaceLandmarkSample {
  return {
    t,
    blendshapes: {
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      mouthSmileLeft: 0,
      mouthSmileRight: 0,
      jawOpen,
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
    trackId,
    mouthWidth: null,
  };
}

// Alternating closed(0.1)/open(0.5) mouth pattern at t=0,1,2,3 - straddles
// MOUTH_ACTIVITY_THRESHOLD (0.15) so each sample has an unambiguous
// active/inactive reading.
const MOUTH_SAMPLES = [sample(0, 0.1, 5), sample(1, 0.5, 5), sample(2, 0.1, 5), sample(3, 0.5, 5)];

describe('verifyLipSync', () => {
  it('reports a high sync score and zero offset when mouth activity matches audio at offset 0', () => {
    const audio: AudioActivityWindow[] = [
      { start: 0, end: 1, hasAudio: false },
      { start: 1, end: 2, hasAudio: true },
      { start: 2, end: 3, hasAudio: false },
      { start: 3, end: 4, hasAudio: true },
    ];

    const [result] = verifyLipSync(MOUTH_SAMPLES, audio);

    expect(result.faceTrackId).toBe(5);
    expect(result.audioSyncScore).toBe(1);
    expect(result.frameOffset).toBe(0);
    expect(result.delayMs).toBe(0);
    expect(result.verified).toBe(true);
  });

  it('finds the best-matching offset when audio is shifted one sample later than video (audio lags)', () => {
    // Same alternating pattern as above but every window shifted 1 second
    // later - the best fit is offset=+1, not 0.
    const audio: AudioActivityWindow[] = [
      { start: 1, end: 2, hasAudio: false },
      { start: 2, end: 3, hasAudio: true },
      { start: 3, end: 4, hasAudio: false },
      { start: 4, end: 5, hasAudio: true },
    ];

    const [result] = verifyLipSync(MOUTH_SAMPLES, audio);

    expect(result.frameOffset).toBe(1);
    expect(result.delayMs).toBe(1000);
    expect(result.audioSyncScore).toBe(1);
    expect(result.verified).toBe(true);
  });

  it('computes a positive lipMotionScore from alternating jawOpen values', () => {
    const [result] = verifyLipSync(MOUTH_SAMPLES, []);
    expect(result.lipMotionScore).toBeCloseTo(0.4);
  });

  it('returns null sync fields when no audio-activity window overlaps any offset', () => {
    const [result] = verifyLipSync(MOUTH_SAMPLES, []);
    expect(result.audioSyncScore).toBeNull();
    expect(result.delayMs).toBeNull();
    expect(result.frameOffset).toBeNull();
    expect(result.verified).toBeNull();
  });

  it('groups samples by trackId, producing one result per track', () => {
    const samples = [...MOUTH_SAMPLES, sample(0, 0.5, 9), sample(1, 0.5, 9)];
    const result = verifyLipSync(samples, []);
    expect(result.map((r) => r.faceTrackId).sort()).toEqual([5, 9]);
  });
});
