import type { ActiveSpeakerSample, FaceLandmarkSample, ObjectTrack } from '@speedora/contracts';
import { selectPrimarySubject } from './select-primary-subject';

function faceSample(
  t: number,
  opts: {
    boundingBox?: { xCenter: number; yCenter: number; width: number; height: number } | null;
    trackId?: number | null;
    yaw?: number | null;
  } = {},
): FaceLandmarkSample {
  return {
    t,
    blendshapes: null,
    rotation:
      opts.yaw !== undefined && opts.yaw !== null ? { pitch: 0, yaw: opts.yaw, roll: 0 } : null,
    boundingBox: opts.boundingBox ?? null,
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
    trackId: opts.trackId ?? null,
    mouthWidth: null,
  };
}

function activeSpeaker(t: number, activeTrackId: number | null): ActiveSpeakerSample {
  return { t, activeTrackId, confidence: activeTrackId !== null ? 0.9 : null };
}

function track(overrides: {
  trackId: number;
  category: string;
  boundingBox: { xCenter: number; yCenter: number; width: number; height: number };
  startTime: number;
  endTime: number;
  attentionScore?: number;
}): ObjectTrack {
  return {
    confidence: 0.9,
    durationSeconds: overrides.endTime - overrides.startTime,
    appearsFrames: 1,
    persistenceScore: 0.5,
    motionSpeed: null,
    motionDirection: null,
    occlusionScore: 0,
    interactionConfidence: 0,
    attentionScore: overrides.attentionScore ?? 0.5,
    attentionConfidence: 0.5,
    ...overrides,
  };
}

const BOX_A = { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 };
const BOX_B = { xCenter: 0.2, yCenter: 0.2, width: 0.1, height: 0.1 };

describe('selectPrimarySubject', () => {
  it('returns a null box/source for a timestamp with no candidate at all', () => {
    const result = selectPrimarySubject({
      sampleTimestamps: [0],
      faceLandmarks: null,
      activeSpeakerSamples: null,
      objectTracks: null,
    });
    expect(result).toEqual([{ t: 0, box: null, trackId: null, facingYaw: null, source: null }]);
  });

  it('Step 1: picks the active speaker when activeTrackId matches the tracked face', () => {
    const result = selectPrimarySubject({
      sampleTimestamps: [0],
      faceLandmarks: [faceSample(0, { boundingBox: BOX_A, trackId: 1, yaw: 12 })],
      activeSpeakerSamples: [activeSpeaker(0, 1)],
      objectTracks: null,
    });
    expect(result[0]).toEqual({
      t: 0,
      box: BOX_A,
      trackId: 1,
      facingYaw: 12,
      source: 'active_speaker',
    });
  });

  it('Step 2: falls back to the visible face when active speaker does not match', () => {
    const result = selectPrimarySubject({
      sampleTimestamps: [0],
      faceLandmarks: [faceSample(0, { boundingBox: BOX_A, trackId: 1, yaw: -5 })],
      activeSpeakerSamples: [activeSpeaker(0, null)],
      objectTracks: null,
    });
    expect(result[0]).toEqual({ t: 0, box: BOX_A, trackId: 1, facingYaw: -5, source: 'face' });
  });

  it('Step 3: picks the largest tracked PERSON when no face is present, over a higher-attention non-person track', () => {
    const result = selectPrimarySubject({
      sampleTimestamps: [5],
      faceLandmarks: null,
      activeSpeakerSamples: null,
      objectTracks: [
        track({
          trackId: 1,
          category: 'person',
          boundingBox: BOX_A,
          startTime: 0,
          endTime: 10,
          attentionScore: 0.3,
        }),
        track({
          trackId: 2,
          category: 'dog',
          boundingBox: BOX_B,
          startTime: 0,
          endTime: 10,
          attentionScore: 0.9,
        }),
      ],
    });
    expect(result[0]).toEqual({
      t: 5,
      box: BOX_A,
      trackId: 1,
      facingYaw: null,
      source: 'tracked_person',
    });
  });

  it('Step 4: falls back to highest objectAttentionScore when no person track is active', () => {
    const result = selectPrimarySubject({
      sampleTimestamps: [5],
      faceLandmarks: null,
      activeSpeakerSamples: null,
      objectTracks: [
        track({
          trackId: 2,
          category: 'dog',
          boundingBox: BOX_B,
          startTime: 0,
          endTime: 10,
          attentionScore: 0.4,
        }),
        track({
          trackId: 3,
          category: 'car',
          boundingBox: BOX_A,
          startTime: 0,
          endTime: 10,
          attentionScore: 0.9,
        }),
      ],
    });
    expect(result[0]).toEqual({
      t: 5,
      box: BOX_A,
      trackId: 3,
      facingYaw: null,
      source: 'attention_object',
    });
  });

  it('only considers tracks whose [startTime, endTime] covers this timestamp', () => {
    const result = selectPrimarySubject({
      sampleTimestamps: [15],
      faceLandmarks: null,
      activeSpeakerSamples: null,
      objectTracks: [
        track({ trackId: 1, category: 'person', boundingBox: BOX_A, startTime: 0, endTime: 10 }),
      ],
    });
    expect(result[0]).toEqual({ t: 15, box: null, trackId: null, facingYaw: null, source: null });
  });

  it('resolves each sample timestamp independently across a full timeline', () => {
    const result = selectPrimarySubject({
      sampleTimestamps: [0, 1, 2],
      faceLandmarks: [faceSample(0, { boundingBox: BOX_A, trackId: 1 })],
      activeSpeakerSamples: null,
      objectTracks: [
        track({ trackId: 2, category: 'person', boundingBox: BOX_B, startTime: 1, endTime: 2 }),
      ],
    });
    expect(result.map((sample) => sample.source)).toEqual([
      'face',
      'tracked_person',
      'tracked_person',
    ]);
  });
});
