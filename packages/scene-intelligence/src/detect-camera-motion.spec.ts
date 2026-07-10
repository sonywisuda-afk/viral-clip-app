import { detectCameraMotion } from './detect-camera-motion';
import type { ExecFileFn } from './detect-scene-cuts';

// No node:child_process mocking at all - the subprocess call is injected via
// deps.execFile (see detect-camera-motion.ts's DetectCameraMotionDeps), same
// pattern as @speedora/facial-intelligence's detect-facial-emotion.spec.ts.
function fakeDeps(execFile: ExecFileFn) {
  return {
    execFile,
    pythonPath: 'python3',
    scriptPath: '/app/scripts/detect_camera_motion.py',
  };
}

describe('detectCameraMotion', () => {
  it('shells out with the video path, time range, and sample interval', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await detectCameraMotion(
      { sourcePath: '/tmp/source.mp4', startTime: 10, endTime: 20 },
      fakeDeps(execFile),
    );

    expect(execFile).toHaveBeenCalledWith('python3', [
      '/app/scripts/detect_camera_motion.py',
      '/tmp/source.mp4',
      '10',
      '20',
      '1',
    ]);
  });

  it('parses the JSON array of camera motion samples from stdout', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { t: 0, dx: null, dy: null, scale: null, rotation: null, ecc: null },
        { t: 1, dx: 0.05, dy: 0.01, scale: 1.0, rotation: 0.2, ecc: 0.9 },
      ]),
      stderr: '',
    });

    const result = await detectCameraMotion(
      { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 2 },
      fakeDeps(execFile),
    );

    expect(result).toEqual([
      { t: 0, dx: null, dy: null, scale: null, rotation: null, ecc: null },
      { t: 1, dx: 0.05, dy: 0.01, scale: 1.0, rotation: 0.2, ecc: 0.9 },
    ]);
  });

  it('propagates the error when the python subprocess fails', async () => {
    const execFile = jest.fn().mockRejectedValue(new Error('python3 exited with code 1'));

    await expect(
      detectCameraMotion(
        { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 5 },
        fakeDeps(execFile),
      ),
    ).rejects.toThrow('python3 exited with code 1');
  });

  it('throws when stdout is not valid JSON matching the output contract', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: 'not json', stderr: '' });

    await expect(
      detectCameraMotion(
        { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 5 },
        fakeDeps(execFile),
      ),
    ).rejects.toThrow();
  });

  it('rejects a malformed input against the detectCameraMotionInputSchema contract', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await expect(
      detectCameraMotion({ sourcePath: '' } as never, fakeDeps(execFile)),
    ).rejects.toThrow();
  });
});
