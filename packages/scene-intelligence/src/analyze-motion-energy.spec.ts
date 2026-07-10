import { analyzeMotionEnergy } from './analyze-motion-energy';
import type { ExecFileFn } from './detect-scene-cuts';

// Fixture text shaped like ffmpeg's real `metadata=print` filter output (per
// documented format - NOT captured from a real ffmpeg run, see
// analyze-motion-energy.ts's "PENDING REAL-MACHINE VERIFICATION" comment).
function fakeMetadataPrintStderr(samples: Array<{ t: number; motionEnergy: number }>): string {
  return samples
    .map(
      (sample, i) =>
        `frame:${i}    pts:${(sample.t * 1000).toFixed(0)}      pts_time:${sample.t}\n` +
        `lavfi.signalstats.YDIF=${sample.motionEnergy.toFixed(6)}`,
    )
    .join('\n');
}

function fakeDeps(execFile: ExecFileFn) {
  return { execFile, ffmpegPath: 'ffmpeg' };
}

describe('analyzeMotionEnergy', () => {
  it("calls ffmpeg's fps/signalstats/metadata filters trimmed to the given time range", async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });

    await analyzeMotionEnergy(
      { videoPath: '/tmp/source.mp4', startTime: 10, endTime: 20 },
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
      'fps=1,signalstats,metadata=print:key=lavfi.signalstats.YDIF',
      '-f',
      'null',
      '-',
    ]);
  });

  it('parses each frame/metadata line pair into a motion energy sample, in order', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: '',
      stderr: fakeMetadataPrintStderr([
        { t: 0, motionEnergy: 0 },
        { t: 1, motionEnergy: 8.5 },
        { t: 2, motionEnergy: 3.25 },
      ]),
    });

    const result = await analyzeMotionEnergy(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 3 },
      fakeDeps(execFile),
    );

    expect(result.samples).toEqual([
      { t: 0, motionEnergy: 0 },
      { t: 1, motionEnergy: 8.5 },
      { t: 2, motionEnergy: 3.25 },
    ]);
  });

  it('returns an empty samples array when there is no metadata output', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });

    const result = await analyzeMotionEnergy(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 3 },
      fakeDeps(execFile),
    );

    expect(result.samples).toEqual([]);
  });

  it('returns an empty samples array (not a thrown error) when the ffmpeg call fails', async () => {
    const execFile = jest.fn().mockRejectedValue(new Error('ffmpeg exited with code 1'));

    const result = await analyzeMotionEnergy(
      { videoPath: '/tmp/source.mp4', startTime: 0, endTime: 3 },
      fakeDeps(execFile),
    );

    expect(result.samples).toEqual([]);
  });

  it('rejects a malformed input against the analyzeMotionEnergyInputSchema contract', async () => {
    const execFile = jest.fn();
    await expect(
      analyzeMotionEnergy({ startTime: 0 } as never, fakeDeps(execFile)),
    ).rejects.toThrow();
    expect(execFile).not.toHaveBeenCalled();
  });
});
