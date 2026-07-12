import { logger } from './logger';

describe('logger', () => {
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

  it('info writes one JSON line to console.log with app/level/message/timestamp', () => {
    logger.info('social account connected', { userId: 'user-1' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({
      level: 'info',
      app: 'api',
      message: 'social account connected',
      userId: 'user-1',
    });
    expect(typeof entry.timestamp).toBe('string');
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('warn writes to console.warn and serializes an Error into name/message/stack', () => {
    logger.warn(
      'failed to revoke token',
      { userId: 'user-1', requestId: 'req-1' },
      new Error('network error'),
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({
      level: 'warn',
      requestId: 'req-1',
      error: { name: 'Error', message: 'network error' },
    });
    expect(typeof entry.error.stack).toBe('string');
  });

  it('error writes to console.error and serializes a non-Error thrown value', () => {
    logger.error('OAuth callback failed', { requestId: 'req-2' }, 'boom');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(entry).toMatchObject({
      level: 'error',
      requestId: 'req-2',
      error: { message: 'boom' },
    });
  });

  it('omits the error field entirely when no error is passed', () => {
    logger.warn('no candidates found');

    const entry = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(entry).not.toHaveProperty('error');
  });

  it('works with no fields at all', () => {
    logger.info('server started');

    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.message).toBe('server started');
  });
});
