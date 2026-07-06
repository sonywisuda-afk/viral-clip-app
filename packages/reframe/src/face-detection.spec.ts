import { detectFaces, type ExecFileFn } from './face-detection';

// No node:child_process mocking at all - the subprocess call is injected via
// deps.execFile (see face-detection.ts's DetectFacesDeps), so this module's
// own tests are pure JSON fixtures + a faked deps, same pattern as
// clip-scoring's faked OpenAI client.
function fakeDeps(execFile: ExecFileFn) {
  return {
    execFile,
    pythonPath: 'python3',
    scriptPath: '/app/scripts/detect_faces.py',
    modelPath: '/app/models/blaze_face_short_range.tflite',
  };
}

describe('detectFaces', () => {
  it('shells out with the video path, time range, sample interval, and model path', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await detectFaces(
      { sourcePath: '/tmp/source.mp4', startTime: 10, endTime: 20 },
      fakeDeps(execFile),
    );

    expect(execFile).toHaveBeenCalledWith('python3', [
      '/app/scripts/detect_faces.py',
      '/tmp/source.mp4',
      '10',
      '20',
      '1',
      '/app/models/blaze_face_short_range.tflite',
    ]);
  });

  it('parses the JSON array of face samples from stdout', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { t: 0, box: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.3 } },
        { t: 1, box: null },
      ]),
      stderr: '',
    });

    const result = await detectFaces(
      { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 2 },
      fakeDeps(execFile),
    );

    expect(result).toEqual([
      { t: 0, box: { xCenter: 0.5, yCenter: 0.5, width: 0.2, height: 0.3 } },
      { t: 1, box: null },
    ]);
  });

  it('propagates the error when the python subprocess fails', async () => {
    const execFile = jest.fn().mockRejectedValue(new Error('python3 exited with code 1'));

    await expect(
      detectFaces({ sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 5 }, fakeDeps(execFile)),
    ).rejects.toThrow('python3 exited with code 1');
  });

  it('rejects a malformed input against the detectFacesInputSchema contract', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await expect(
      detectFaces({ sourcePath: '/tmp/source.mp4' } as never, fakeDeps(execFile)),
    ).rejects.toThrow();
  });
});
