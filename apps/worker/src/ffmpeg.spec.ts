const execFileMock = jest.fn(
  (
    _file: string,
    _args: string[],
    callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
  ) => {
    callback(null, { stdout: '', stderr: '' });
  },
);

jest.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => (execFileMock as unknown as (...a: unknown[]) => void)(...args),
}));

import { escapeFfmpegFilterPath, getVideoDimensions, renderClip } from './ffmpeg';

describe('escapeFfmpegFilterPath', () => {
  it('escapes a Windows absolute path for use in a subtitles= filter', () => {
    expect(escapeFfmpegFilterPath('C:\\Users\\me\\clip.ass')).toBe('C\\:/Users/me/clip.ass');
  });

  it('leaves a POSIX path without a drive letter mostly unchanged', () => {
    expect(escapeFfmpegFilterPath('/tmp/clip.ass')).toBe('/tmp/clip.ass');
  });
});

describe('getVideoDimensions', () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it('parses width,height from ffprobe csv output', async () => {
    execFileMock.mockImplementationOnce((_file, _args, callback) => {
      callback(null, { stdout: '320,240\n', stderr: '' });
    });

    const result = await getVideoDimensions('/tmp/source.mp4');

    expect(result).toEqual({ width: 320, height: 240 });
    const [file, args] = execFileMock.mock.calls[0];
    expect(file).toBe('ffprobe');
    expect(args).toEqual(
      expect.arrayContaining(['-select_streams', 'v:0', '-of', 'csv=p=0', '/tmp/source.mp4']),
    );
  });
});

describe('renderClip', () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it('invokes ffmpeg with -ss/-t trimming and no -vf when there are no subtitles and no reframe', async () => {
    await renderClip({
      inputPath: '/tmp/source.mp4',
      startTime: 5,
      endTime: 15,
      subtitlesPath: null,
      outputPath: '/tmp/output.mp4',
      reframe: null,
    });

    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [, args] = execFileMock.mock.calls[0];
    expect(args).toEqual(
      expect.arrayContaining(['-ss', '5', '-i', '/tmp/source.mp4', '-t', '10', '/tmp/output.mp4']),
    );
    expect(args).not.toEqual(expect.arrayContaining(['-vf']));
  });

  it('adds a subtitles filter when subtitlesPath is provided', async () => {
    await renderClip({
      inputPath: '/tmp/source.mp4',
      startTime: 5,
      endTime: 15,
      subtitlesPath: '/tmp/captions.ass',
      outputPath: '/tmp/output.mp4',
      reframe: null,
    });

    const [, args] = execFileMock.mock.calls[0];
    const vfIndex = args.indexOf('-vf');
    expect(vfIndex).toBeGreaterThanOrEqual(0);
    expect(args[vfIndex + 1]).toBe("subtitles='/tmp/captions.ass'");
  });

  it('adds a static crop filter (no sendcmd) when reframe has no sendCmdPath', async () => {
    await renderClip({
      inputPath: '/tmp/source.mp4',
      startTime: 5,
      endTime: 15,
      subtitlesPath: null,
      outputPath: '/tmp/output.mp4',
      reframe: { width: 136, height: 240, x: 92, y: 0, sendCmdPath: null },
    });

    const [, args] = execFileMock.mock.calls[0];
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toBe('crop=w=136:h=240:x=92:y=0');
  });

  it('adds a sendcmd + tagged crop filter when reframe has a sendCmdPath', async () => {
    await renderClip({
      inputPath: '/tmp/source.mp4',
      startTime: 5,
      endTime: 15,
      subtitlesPath: null,
      outputPath: '/tmp/output.mp4',
      reframe: { width: 136, height: 240, x: 0, y: 0, sendCmdPath: '/tmp/cmds.txt' },
    });

    const [, args] = execFileMock.mock.calls[0];
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toBe('sendcmd=f=/tmp/cmds.txt,crop@reframe=w=136:h=240:x=0:y=0');
  });

  it('orders crop before subtitles so captions burn onto the reframed picture', async () => {
    await renderClip({
      inputPath: '/tmp/source.mp4',
      startTime: 5,
      endTime: 15,
      subtitlesPath: '/tmp/captions.ass',
      outputPath: '/tmp/output.mp4',
      reframe: { width: 136, height: 240, x: 92, y: 0, sendCmdPath: null },
    });

    const [, args] = execFileMock.mock.calls[0];
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toBe("crop=w=136:h=240:x=92:y=0,subtitles='/tmp/captions.ass'");
  });

  it('propagates the error when ffmpeg fails', async () => {
    execFileMock.mockImplementationOnce((_file, _args, callback) => {
      callback(new Error('ffmpeg exited with code 1'), { stdout: '', stderr: 'boom' });
    });

    await expect(
      renderClip({
        inputPath: '/tmp/source.mp4',
        startTime: 0,
        endTime: 5,
        subtitlesPath: null,
        outputPath: '/tmp/output.mp4',
        reframe: null,
      }),
    ).rejects.toThrow('ffmpeg exited with code 1');
  });
});
