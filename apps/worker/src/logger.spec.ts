import { forStage } from './logger';

describe('forStage', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('info writes one JSON line to console.log with stage/app/level/message/timestamp', () => {
    const logger = forStage('transcribe');
    logger.info('processing video', { videoId: 'video-1' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({
      level: 'info',
      app: 'worker',
      stage: 'transcribe',
      message: 'processing video',
      videoId: 'video-1',
    });
    expect(typeof entry.timestamp).toBe('string');
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('debug writes to console.log', () => {
    forStage('render-clip').debug('starting');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toMatchObject({ level: 'debug' });
  });

  it('warn writes to console.warn and serializes an Error into name/message/stack', () => {
    forStage('render-clip').warn(
      'face detection failed, falling back to center-crop',
      { clipId: 'clip-1' },
      new Error('python3 exited with code 1'),
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({
      level: 'warn',
      stage: 'render-clip',
      clipId: 'clip-1',
      error: { name: 'Error', message: 'python3 exited with code 1' },
    });
    expect(typeof entry.error.stack).toBe('string');
  });

  it('error writes to console.error and serializes a non-Error thrown value', () => {
    forStage('publish-clip').error('publish failed', { publishRecordId: 'record-1' }, 'boom');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({
      level: 'error',
      stage: 'publish-clip',
      publishRecordId: 'record-1',
      error: { message: 'boom' },
    });
  });

  it('omits the error field entirely when no error is passed', () => {
    forStage('detect-clips').warn('no candidates found', { videoId: 'video-1' });

    const entry = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(entry).not.toHaveProperty('error');
  });

  it('binds stage once so every call from the same logger carries it', () => {
    const logger = forStage('import-youtube');
    logger.info('downloading');
    logger.error('failed', {}, new Error('x'));

    expect(JSON.parse(logSpy.mock.calls[0][0]).stage).toBe('import-youtube');
    expect(JSON.parse(errorSpy.mock.calls[0][0]).stage).toBe('import-youtube');
  });
});
