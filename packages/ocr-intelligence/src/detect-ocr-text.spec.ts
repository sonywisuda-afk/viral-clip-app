import { detectOcrText, type ExecFileFn } from './detect-ocr-text';

// No node:child_process mocking - subprocess call injected via
// deps.execFile, same pattern as @speedora/facial-intelligence's
// detect-facial-emotion.spec.ts.
function fakeDeps(execFile: ExecFileFn) {
  return {
    execFile,
    pythonPath: 'python3',
    scriptPath: '/app/scripts/detect_ocr_text.py',
    tesseractPath: '',
  };
}

describe('detectOcrText', () => {
  it('shells out with the video path, time range, sample interval, and tesseract path', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await detectOcrText(
      { sourcePath: '/tmp/source.mp4', startTime: 10, endTime: 20 },
      { ...fakeDeps(execFile), tesseractPath: '/usr/bin/tesseract' },
    );

    expect(execFile).toHaveBeenCalledWith('python3', [
      '/app/scripts/detect_ocr_text.py',
      '/tmp/source.mp4',
      '10',
      '20',
      '1',
      '/usr/bin/tesseract',
    ]);
  });

  it('parses a sample with multiple text blocks (subtitle + logo in the same frame) from stdout', async () => {
    const sample = {
      t: 0,
      textBlocks: [
        {
          text: 'hello world',
          boundingBox: { xCenter: 0.5, yCenter: 0.85, width: 0.6, height: 0.05 },
          confidence: 0.92,
        },
        {
          text: 'ACME',
          boundingBox: { xCenter: 0.92, yCenter: 0.08, width: 0.1, height: 0.04 },
          confidence: 0.75,
        },
      ],
    };
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([sample]),
      stderr: '',
    });

    const result = await detectOcrText(
      { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 1 },
      fakeDeps(execFile),
    );

    expect(result).toEqual([sample]);
  });

  it('parses an empty sample (no text found) from stdout', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([{ t: 0, textBlocks: [] }]),
      stderr: '',
    });

    const result = await detectOcrText(
      { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 1 },
      fakeDeps(execFile),
    );

    expect(result[0].textBlocks).toEqual([]);
  });

  it('propagates the error when the python subprocess fails', async () => {
    const execFile = jest.fn().mockRejectedValue(new Error('python3 exited with code 1'));

    await expect(
      detectOcrText(
        { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 5 },
        fakeDeps(execFile),
      ),
    ).rejects.toThrow('python3 exited with code 1');
  });

  it('throws when stdout is not valid JSON matching the output contract', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: 'not json', stderr: '' });

    await expect(
      detectOcrText(
        { sourcePath: '/tmp/source.mp4', startTime: 0, endTime: 5 },
        fakeDeps(execFile),
      ),
    ).rejects.toThrow();
  });

  it('rejects a malformed input against the detectOcrTextInputSchema contract', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await expect(
      detectOcrText({ sourcePath: '/tmp/source.mp4' } as never, fakeDeps(execFile)),
    ).rejects.toThrow();
  });
});
