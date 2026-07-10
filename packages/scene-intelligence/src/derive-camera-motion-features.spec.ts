import { deriveCameraMotionFeatures } from './derive-camera-motion-features';

const NULL_SAMPLE = { dx: null, dy: null, scale: null, rotation: null, ecc: null };

describe('deriveCameraMotionFeatures', () => {
  it('returns all-null fields when there are no samples', () => {
    const result = deriveCameraMotionFeatures([]);
    expect(result).toEqual({
      panScore: null,
      tiltScore: null,
      zoomScore: null,
      shakeScore: null,
      dominantMotionType: null,
    });
  });

  it('returns all-null fields when the only sample is the unclassifiable first one', () => {
    const result = deriveCameraMotionFeatures([{ t: 0, ...NULL_SAMPLE }]);
    expect(result).toEqual({
      panScore: null,
      tiltScore: null,
      zoomScore: null,
      shakeScore: null,
      dominantMotionType: null,
    });
  });

  it('classifies sustained horizontal translation as dominant pan', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.05, dy: 0.001, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 2, dx: 0.05, dy: 0.001, scale: 1.0, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.panScore).toBe(1);
    expect(result.tiltScore).toBe(0);
    expect(result.zoomScore).toBe(0);
    expect(result.dominantMotionType).toBe('pan');
  });

  it('classifies sustained vertical translation as dominant tilt', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.001, dy: 0.05, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 2, dx: 0.001, dy: 0.05, scale: 1.0, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.tiltScore).toBe(1);
    expect(result.panScore).toBe(0);
    expect(result.dominantMotionType).toBe('tilt');
  });

  it('classifies a large scale change as dominant zoom', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.001, dy: 0.001, scale: 1.1, rotation: 0, ecc: 0.9 },
      { t: 2, dx: 0.001, dy: 0.001, scale: 1.12, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.zoomScore).toBe(1);
    expect(result.dominantMotionType).toBe('zoom');
  });

  it('classifies tiny sub-threshold movement as static with zero shakeScore', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.001, dy: 0.001, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 2, dx: -0.001, dy: -0.001, scale: 1.001, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.dominantMotionType).toBe('static');
    // The dx/dy sign flips between the two samples, but both are below
    // PAN_TILT_THRESHOLD - sub-threshold noise must not count as a "shake"
    // reversal.
    expect(result.shakeScore).toBe(0);
  });

  it('detects alternating above-threshold translation as dominant shake, overriding the per-sample pan majority', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.03, dy: 0, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 2, dx: -0.03, dy: 0, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 3, dx: 0.03, dy: 0, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 4, dx: -0.03, dy: 0, scale: 1.0, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.panScore).toBe(1);
    expect(result.shakeScore).toBe(1);
    expect(result.dominantMotionType).toBe('shake');
  });

  it('returns a null shakeScore when fewer than two samples are classifiable', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.05, dy: 0, scale: 1.0, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.shakeScore).toBeNull();
  });

  it('breaks a pan/tilt count tie toward pan (earlier in the fixed priority order)', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.05, dy: 0.001, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 2, dx: 0.001, dy: 0.05, scale: 1.0, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.panScore).toBe(0.5);
    expect(result.tiltScore).toBe(0.5);
    expect(result.dominantMotionType).toBe('pan');
  });

  it('ignores samples that failed to align (null transform) when computing scores', () => {
    const result = deriveCameraMotionFeatures([
      { t: 0, ...NULL_SAMPLE },
      { t: 1, dx: 0.05, dy: 0, scale: 1.0, rotation: 0, ecc: 0.9 },
      { t: 2, ...NULL_SAMPLE },
      { t: 3, dx: 0.05, dy: 0, scale: 1.0, rotation: 0, ecc: 0.9 },
    ]);
    expect(result.panScore).toBe(1);
  });
});
