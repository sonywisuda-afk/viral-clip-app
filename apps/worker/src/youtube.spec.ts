import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// A minimal fake ChildProcess: real stdout/stderr streams (so the module's
// line-buffering logic under test runs unmodified) plus an EventEmitter's
// on/emit for the process-level 'error'/'close' events.
function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}

let lastChild: ReturnType<typeof createFakeChild>;
const spawnMock = jest.fn((_file: string, _args: string[]) => {
  lastChild = createFakeChild();
  return lastChild;
});

jest.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => (spawnMock as unknown as (...a: unknown[]) => unknown)(...args),
}));

import { downloadYoutubeVideo } from './youtube';

describe('downloadYoutubeVideo', () => {
  beforeEach(() => {
    spawnMock.mockClear();
    delete process.env.YTDLP_PATH;
    delete process.env.FFMPEG_PATH;
  });

  it('invokes yt-dlp with the url, an exact output path, and mp4 merge format', async () => {
    const promise = downloadYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/tmp/out.mp4');
    lastChild.emit('close', 0);
    await promise;

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [file, args] = spawnMock.mock.calls[0];
    expect(file).toBe('yt-dlp');
    expect(args).toEqual(
      expect.arrayContaining([
        '--no-playlist',
        '--merge-output-format',
        'mp4',
        '-o',
        '/tmp/out.mp4',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      ]),
    );
  });

  it('prefers H.264 (avc1) video so the source preview plays in every browser', async () => {
    const promise = downloadYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/tmp/out.mp4');
    lastChild.emit('close', 0);
    await promise;

    const [, args] = spawnMock.mock.calls[0];
    const format = args[args.indexOf('-f') + 1];
    // First-choice selector must pin avc1 video; AV1 is only a later fallback.
    expect(format.startsWith('bv*[vcodec^=avc1]')).toBe(true);
  });

  it('uses YTDLP_PATH when set, instead of the "yt-dlp" default', async () => {
    process.env.YTDLP_PATH = '/opt/bin/yt-dlp';
    jest.resetModules();
    jest.doMock('node:child_process', () => ({
      spawn: (...args: unknown[]) => (spawnMock as unknown as (...a: unknown[]) => unknown)(...args),
    }));
    const { downloadYoutubeVideo: downloadWithOverride } = await import('./youtube');

    const promise = downloadWithOverride('https://youtu.be/dQw4w9WgXcQ', '/tmp/out.mp4');
    lastChild.emit('close', 0);
    await promise;

    const [file] = spawnMock.mock.calls[0];
    expect(file).toBe('/opt/bin/yt-dlp');
  });

  it('does not pass --ffmpeg-location when FFMPEG_PATH is unset', async () => {
    const promise = downloadYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/tmp/out.mp4');
    lastChild.emit('close', 0);
    await promise;

    const [, args] = spawnMock.mock.calls[0];
    expect(args).not.toContain('--ffmpeg-location');
  });

  it('passes --ffmpeg-location to yt-dlp when FFMPEG_PATH is set, so its own merge subprocess can find ffmpeg even when ffmpeg is not on the system PATH', async () => {
    process.env.FFMPEG_PATH = 'C:\\ffmpeg\\bin\\ffmpeg.exe';

    const promise = downloadYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/tmp/out.mp4');
    lastChild.emit('close', 0);
    await promise;

    const [, args] = spawnMock.mock.calls[0];
    expect(args).toEqual(
      expect.arrayContaining(['--ffmpeg-location', 'C:\\ffmpeg\\bin\\ffmpeg.exe']),
    );
  });

  it('rejects with yt-dlp\'s stderr when it exits non-zero', async () => {
    const promise = downloadYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/tmp/out.mp4');
    lastChild.stderr.write('ERROR: unable to download video data: HTTP Error 403: Forbidden\n');
    lastChild.emit('close', 1);

    await expect(promise).rejects.toThrow('yt-dlp exited with code 1');
    await expect(promise).rejects.toThrow('HTTP Error 403: Forbidden');
  });

  it('propagates a spawn-level error (e.g. yt-dlp binary not found)', async () => {
    const promise = downloadYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/tmp/out.mp4');
    lastChild.emit('error', new Error('spawn yt-dlp ENOENT'));

    await expect(promise).rejects.toThrow('spawn yt-dlp ENOENT');
  });

  it('parses --progress-template output lines and reports each percentage via onProgress', async () => {
    const onProgress = jest.fn();
    const promise = downloadYoutubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '/tmp/out.mp4',
      onProgress,
    );

    lastChild.stdout.write('SPEEDORA_PROGRESS   0.0%\n');
    lastChild.stdout.write('SPEEDORA_PROGRESS  45.2%\n');
    lastChild.stdout.write('SPEEDORA_PROGRESS 100.0%\n');
    lastChild.emit('close', 0);
    await promise;

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 0);
    expect(onProgress).toHaveBeenNthCalledWith(2, 45.2);
    expect(onProgress).toHaveBeenNthCalledWith(3, 100);
  });

  it('buffers a progress line split across multiple stdout chunks before parsing it', async () => {
    const onProgress = jest.fn();
    const promise = downloadYoutubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '/tmp/out.mp4',
      onProgress,
    );

    lastChild.stdout.write('SPEEDORA_PROG');
    lastChild.stdout.write('RESS  12.3%\n');
    lastChild.emit('close', 0);
    await promise;

    expect(onProgress).toHaveBeenCalledWith(12.3);
  });

  it('ignores stdout lines that are not progress updates', async () => {
    const onProgress = jest.fn();
    const promise = downloadYoutubeVideo(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '/tmp/out.mp4',
      onProgress,
    );

    lastChild.stdout.write('[youtube] Extracting URL: https://youtu.be/dQw4w9WgXcQ\n');
    lastChild.emit('close', 0);
    await promise;

    expect(onProgress).not.toHaveBeenCalled();
  });

  it('works with no onProgress callback at all', async () => {
    const promise = downloadYoutubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/tmp/out.mp4');

    lastChild.stdout.write('SPEEDORA_PROGRESS  50.0%\n');
    lastChild.emit('close', 0);

    await expect(promise).resolves.toBeUndefined();
  });
});
