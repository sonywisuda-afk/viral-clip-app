import type { FaceLandmarkSample } from '@speedora/contracts';
import { deriveTrackingQualityMetrics } from './derive-tracking-quality-metrics';

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

function sampleWithFace(overrides: Partial<FaceLandmarkSample> = {}): FaceLandmarkSample {
  return {
    ...EMPTY_SAMPLE,
    boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
    sharpness: 300,
    brightness: 128,
    mouthContrastRatio: 1,
    faceDescriptor: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    trackId: 0,
    ...overrides,
  };
}

describe('deriveTrackingQualityMetrics', () => {
  it('returns all-null metrics (and faceVisibilityRatio null) for an empty sample array', () => {
    expect(deriveTrackingQualityMetrics([])).toEqual({
      trackFragmentationRate: null,
      idSwitchCount: null,
      lostTrackDurationSeconds: null,
      reidentificationSuccessRate: null,
      faceVisibilityRatio: null,
      faceOcclusionRatio: null,
      averageLandmarkConfidence: null,
      landmarkJitterScore: null,
      kalmanCorrectionRatio: null,
      trackingConfidence: null,
      tracks: [],
    });
  });

  it('returns faceVisibilityRatio 0 (not null) but everything else null when a face was never found', () => {
    const result = deriveTrackingQualityMetrics([EMPTY_SAMPLE, EMPTY_SAMPLE]);
    expect(result.faceVisibilityRatio).toBe(0);
    expect(result.trackFragmentationRate).toBeNull();
    expect(result.tracks).toEqual([]);
  });

  it('gives trackFragmentationRate 0 and kalmanCorrectionRatio 1 for one unbroken track', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 5 }),
      sampleWithFace({ t: 1, trackId: 5 }),
      sampleWithFace({ t: 2, trackId: 5 }),
    ]);
    expect(result.trackFragmentationRate).toBe(0);
    expect(result.kalmanCorrectionRatio).toBe(1);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({ trackId: 5, frameCount: 3, startTime: 0, endTime: 2 });
  });

  it('counts a track break as a fragmentation event and kalmanCorrectionRatio drops below 1', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0 }),
      sampleWithFace({ t: 1, trackId: 0 }),
      sampleWithFace({ t: 2, trackId: 1 }),
    ]);
    expect(result.trackFragmentationRate).toBeCloseTo(0.5);
    expect(result.kalmanCorrectionRatio).toBeCloseTo(0.5);
    expect(result.tracks).toHaveLength(2);
  });

  it('flags a run boundary as a likely id switch when the face descriptors across the break are near-identical', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0, faceDescriptor: [1, 1, 1, 1, 1, 1, 1, 1, 1] }),
      sampleWithFace({ t: 1, trackId: 1, faceDescriptor: [1.01, 1, 1, 1, 1, 1, 1, 1, 1] }),
    ]);
    expect(result.idSwitchCount).toBe(1);
    expect(result.tracks[0].idSwitchCount).toBe(0); // first run, nothing to compare against
    expect(result.tracks[1].idSwitchCount).toBe(1);
  });

  it('does NOT flag an id switch when the descriptors across the break are clearly different', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0, faceDescriptor: [1, 1, 1, 1, 1, 1, 1, 1, 1] }),
      sampleWithFace({ t: 1, trackId: 1, faceDescriptor: [3, 3, 3, 3, 3, 3, 3, 3, 3] }),
    ]);
    expect(result.idSwitchCount).toBe(0);
  });

  it('does not evaluate an id switch when either side of the break lacks a faceDescriptor', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0, faceDescriptor: null }),
      sampleWithFace({ t: 1, trackId: 1, faceDescriptor: [1, 1, 1, 1, 1, 1, 1, 1, 1] }),
    ]);
    expect(result.idSwitchCount).toBe(0);
  });

  it('counts lostTrackDurationSeconds and a successful re-identification for a mid-clip gap with the same trackId on both sides', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0 }),
      EMPTY_SAMPLE, // t=1, gap
      EMPTY_SAMPLE, // t=2, gap
      sampleWithFace({ t: 3, trackId: 0 }), // same track re-acquired
    ]);
    expect(result.lostTrackDurationSeconds).toBe(2);
    expect(result.reidentificationSuccessRate).toBe(1);
  });

  it('counts a failed re-identification when the trackId differs after the gap', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0 }),
      EMPTY_SAMPLE,
      sampleWithFace({ t: 2, trackId: 1 }), // different track after the gap
    ]);
    expect(result.reidentificationSuccessRate).toBe(0);
  });

  it('does not count a leading/trailing absence (no face on one side) as a lost-track gap', () => {
    const result = deriveTrackingQualityMetrics([
      EMPTY_SAMPLE, // leading absence, no "before" sample
      sampleWithFace({ t: 1, trackId: 0 }),
      sampleWithFace({ t: 2, trackId: 0 }),
      EMPTY_SAMPLE, // trailing absence, no "after" sample
    ]);
    expect(result.lostTrackDurationSeconds).toBe(0);
    expect(result.reidentificationSuccessRate).toBeNull();
  });

  it('computes faceOcclusionRatio and averageLandmarkConfidence from mouthContrastRatio/sharpness', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ mouthContrastRatio: 0.05, sharpness: 500 }), // occluded, max confidence
      sampleWithFace({ mouthContrastRatio: 0.8, sharpness: 0 }), // clear, zero confidence
    ]);
    expect(result.faceOcclusionRatio).toBe(0.5);
    expect(result.averageLandmarkConfidence).toBeCloseTo(0.5);
  });

  it('gives landmarkJitterScore 0 for a perfectly still bounding box within a track', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({
        t: 0,
        trackId: 0,
        boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
      sampleWithFace({
        t: 1,
        trackId: 0,
        boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
    ]);
    expect(result.landmarkJitterScore).toBe(0);
  });

  it('gives a higher landmarkJitterScore for a bounding box that moves a lot between samples', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({
        t: 0,
        trackId: 0,
        boundingBox: { xCenter: 0.2, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
      sampleWithFace({
        t: 1,
        trackId: 0,
        boundingBox: { xCenter: 0.8, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
    ]);
    expect(result.landmarkJitterScore).toBe(1); // clamped at the cap
  });

  it('does not count the jump across a track break as jitter', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({
        t: 0,
        trackId: 0,
        boundingBox: { xCenter: 0.1, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
      sampleWithFace({
        t: 1,
        trackId: 1,
        boundingBox: { xCenter: 0.9, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
    ]);
    // Each run has only 1 sample - no within-run consecutive pair to measure jitter from.
    expect(result.landmarkJitterScore).toBeNull();
  });

  it('marks a track unstable when it is too short, even if otherwise clean', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0 }),
      sampleWithFace({ t: 1, trackId: 0 }),
    ]);
    expect(result.tracks[0].stable).toBe(false);
  });

  it('marks a long, clean, low-jitter track as stable', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0 }),
      sampleWithFace({ t: 1, trackId: 0 }),
      sampleWithFace({ t: 2, trackId: 0 }),
      sampleWithFace({ t: 3, trackId: 0 }),
    ]);
    expect(result.tracks[0].stable).toBe(true);
  });

  it('marks a long track unstable when occlusion dominates', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({ t: 0, trackId: 0, mouthContrastRatio: 0.05 }),
      sampleWithFace({ t: 1, trackId: 0, mouthContrastRatio: 0.05 }),
      sampleWithFace({ t: 2, trackId: 0, mouthContrastRatio: 0.05 }),
      sampleWithFace({ t: 3, trackId: 0, mouthContrastRatio: 0.05 }),
    ]);
    expect(result.tracks[0].stable).toBe(false);
  });

  it('computes trackingConfidence as the average of whichever component scores are available', () => {
    const result = deriveTrackingQualityMetrics([
      sampleWithFace({
        t: 0,
        trackId: 0,
        mouthContrastRatio: null,
        sharpness: null,
        boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
      sampleWithFace({
        t: 1,
        trackId: 0,
        mouthContrastRatio: null,
        sharpness: null,
        boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
      }),
    ]);
    // Only kalmanCorrectionRatio(1), faceVisibilityRatio(1), and
    // (1 - landmarkJitterScore)(1) are available here - faceOcclusionRatio/
    // averageLandmarkConfidence are both null (no mouthContrastRatio/
    // sharpness data) and excluded from the average, not treated as 0.
    expect(result.trackingConfidence).toBe(1);
  });
});
