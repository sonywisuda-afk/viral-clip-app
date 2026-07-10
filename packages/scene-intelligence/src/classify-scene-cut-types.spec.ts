import { classifySceneCutTypes } from './classify-scene-cut-types';
import type { ExecFileFn } from './detect-scene-cuts';

// Fixture text shaped like ffmpeg's real blackdetect filter output (per
// documented format - NOT captured from a real ffmpeg run, see
// classify-scene-cut-types.ts's "PENDING REAL-MACHINE VERIFICATION" comment).
function fakeBlackdetectStderr(intervals: Array<{ start: number; end: number }>): string {
  const lines = intervals.map(
    (interval) =>
      `[blackdetect @ 0x1] black_start:${interval.start} black_end:${interval.end} ` +
      `black_duration:${(interval.end - interval.start).toFixed(3)}`,
  );
  return lines.join('\n');
}

function fakeDeps(execFile: ExecFileFn) {
  return { execFile, ffmpegPath: 'ffmpeg' };
}

describe('classifySceneCutTypes', () => {
  it('calls ffmpeg blackdetect trimmed to the given time range', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });

    await classifySceneCutTypes(
      { videoPath: '/tmp/source.mp4', startTime: 10, endTime: 20, cuts: [12] },
      fakeDeps(execFile),
    );

    expect(execFile).toHaveBeenCalledWith('ffmpeg', [
      '-ss',
      '10',
      '-to',
      '20',
      '-i',
      '/tmp/source.mp4',
      '-vf',
      'blackdetect=d=0.1:pic_th=0.98',
      '-f',
      'null',
      '-',
    ]);
  });

  it('returns an empty events array without calling ffmpeg when there are no cuts', async () => {
    const execFile = jest.fn();

    const result = await classifySceneCutTypes(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 10, cuts: [] },
      fakeDeps(execFile),
    );

    expect(result.events).toEqual([]);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('classifies a cut near a detected black interval as a fade', async () => {
    const execFile = jest
      .fn()
      .mockResolvedValue({ stdout: '', stderr: fakeBlackdetectStderr([{ start: 4.9, end: 5.2 }]) });

    const result = await classifySceneCutTypes(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 10, cuts: [5.1] },
      fakeDeps(execFile),
    );

    expect(result.events).toEqual([{ t: 5.1, type: 'fade' }]);
  });

  it('classifies a cut far from any black interval as a hard cut', async () => {
    const execFile = jest
      .fn()
      .mockResolvedValue({ stdout: '', stderr: fakeBlackdetectStderr([{ start: 4.9, end: 5.2 }]) });

    const result = await classifySceneCutTypes(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 10, cuts: [8.0] },
      fakeDeps(execFile),
    );

    expect(result.events).toEqual([{ t: 8.0, type: 'hard_cut' }]);
  });

  it('classifies every cut independently when there are several black intervals', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: '',
      stderr: fakeBlackdetectStderr([
        { start: 1.9, end: 2.1 },
        { start: 7.4, end: 7.6 },
      ]),
    });

    const result = await classifySceneCutTypes(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 10, cuts: [2.0, 4.0, 7.5] },
      fakeDeps(execFile),
    );

    expect(result.events).toEqual([
      { t: 2.0, type: 'fade' },
      { t: 4.0, type: 'hard_cut' },
      { t: 7.5, type: 'fade' },
    ]);
  });

  it('falls back to classifying every cut as a hard cut (not a thrown error) when ffmpeg fails', async () => {
    const execFile = jest.fn().mockRejectedValue(new Error('ffmpeg exited with code 1'));

    const result = await classifySceneCutTypes(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 10, cuts: [3.0, 6.0] },
      fakeDeps(execFile),
    );

    expect(result.events).toEqual([
      { t: 3.0, type: 'hard_cut' },
      { t: 6.0, type: 'hard_cut' },
    ]);
  });

  it('rejects a malformed input against the classifySceneCutTypesInputSchema contract', async () => {
    const execFile = jest.fn();
    await expect(
      classifySceneCutTypes({ startTime: 0 } as never, fakeDeps(execFile)),
    ).rejects.toThrow();
    expect(execFile).not.toHaveBeenCalled();
  });
});
