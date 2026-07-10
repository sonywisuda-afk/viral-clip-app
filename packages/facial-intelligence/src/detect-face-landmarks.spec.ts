import { detectFaceLandmarks } from './detect-face-landmarks';
import type { ExecFileFn } from './detect-facial-emotion';

// No node:child_process mocking - subprocess call injected via
// deps.execFile, same pattern as detect-facial-emotion.spec.ts.
function fakeDeps(execFile: ExecFileFn) {
  return {
    execFile,
    pythonPath: 'python3',
    scriptPath: '/app/scripts/detect_face_landmarks.py',
    modelPath: '/app/models/face_landmarker.task',
  };
}

const FULL_SAMPLE = {
  t: 0,
  blendshapes: {
    eyeBlinkLeft: 0.1,
    eyeBlinkRight: 0.1,
    mouthSmileLeft: 0.6,
    mouthSmileRight: 0.6,
    jawOpen: 0.2,
    cheekSquintLeft: 0.2,
    cheekSquintRight: 0.2,
    eyeSquintLeft: 0.1,
    eyeSquintRight: 0.1,
    browDownLeft: 0.1,
    browDownRight: 0.1,
    browInnerUp: 0.1,
    browOuterUpLeft: 0.1,
    browOuterUpRight: 0.1,
  },
  rotation: { pitch: 1.5, yaw: -3.2, roll: 0.4 },
  boundingBox: { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 },
  leftIris: { x: 0.45, y: 0.5, z: -0.02 },
  rightIris: { x: 0.55, y: 0.5, z: -0.02 },
  leftEyeInnerCorner: { x: 0.47, y: 0.5, z: -0.01 },
  leftEyeOuterCorner: { x: 0.4, y: 0.5, z: -0.01 },
  rightEyeInnerCorner: { x: 0.53, y: 0.5, z: -0.01 },
  rightEyeOuterCorner: { x: 0.6, y: 0.5, z: -0.01 },
  sharpness: 312.5,
  brightness: 128,
  mouthContrastRatio: 0.9,
  faceDescriptor: [1.0, 0.9, 1.1, 0.5, 0.6, 0.4, 1.3, 1.2, 0.8],
  trackId: 0,
  mouthWidth: 0.5,
};

describe('detectFaceLandmarks', () => {
  it('shells out with the video path, time range, and sample interval', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await detectFaceLandmarks(
      { sourcePath: '/tmp/source.mp4', startTime: 10, endTime: 20 },
      fakeDeps(execFile),
    );

    expect(execFile).toHaveBeenCalledWith('python3', [
      '/app/scripts/detect_face_landmarks.py',
      '/tmp/source.mp4',
      '10',
      '20',
      '1',
      '/app/models/face_landmarker.task',
    ]);
  });

  it('parses a full sample (face found) from stdout', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([FULL_SAMPLE]),
      stderr: '',
    });

    const result = await detectFaceLandmarks(
      { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 1 },
      fakeDeps(execFile),
    );

    expect(result).toEqual([FULL_SAMPLE]);
  });

  it('parses an empty sample (no face found) from stdout', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([
        {
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
        },
      ]),
      stderr: '',
    });

    const result = await detectFaceLandmarks(
      { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 1 },
      fakeDeps(execFile),
    );

    expect(result[0].blendshapes).toBeNull();
    expect(result[0].boundingBox).toBeNull();
    expect(result[0].sharpness).toBeNull();
    expect(result[0].faceDescriptor).toBeNull();
    expect(result[0].trackId).toBeNull();
  });

  it('propagates the error when the python subprocess fails', async () => {
    const execFile = jest.fn().mockRejectedValue(new Error('python3 exited with code 1'));

    await expect(
      detectFaceLandmarks(
        { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 5 },
        fakeDeps(execFile),
      ),
    ).rejects.toThrow('python3 exited with code 1');
  });

  it('throws when stdout is not valid JSON matching the output contract', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: 'not json', stderr: '' });

    await expect(
      detectFaceLandmarks(
        { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 5 },
        fakeDeps(execFile),
      ),
    ).rejects.toThrow();
  });

  it('rejects a malformed input against the detectFaceLandmarksInputSchema contract', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await expect(
      detectFaceLandmarks({ sourcePath: '/tmp/source.mp4' } as never, fakeDeps(execFile)),
    ).rejects.toThrow();
  });
});
