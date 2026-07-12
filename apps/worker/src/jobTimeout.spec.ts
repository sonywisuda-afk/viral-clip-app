import { JobTimeoutError, withJobTimeout } from './jobTimeout';

describe('withJobTimeout', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves with the wrapped function's value when it finishes before the timeout", async () => {
    const result = await withJobTimeout(() => Promise.resolve('done'), 1000, 'test-job');

    expect(result).toBe('done');
  });

  it("propagates the wrapped function's own rejection unchanged", async () => {
    const error = new Error('real failure');

    await expect(withJobTimeout(() => Promise.reject(error), 1000, 'test-job')).rejects.toBe(error);
  });

  it('rejects with a JobTimeoutError once the timeout elapses before the wrapped function settles', async () => {
    jest.useFakeTimers();

    const neverSettles = new Promise<string>(() => {});
    const promise = withJobTimeout(() => neverSettles, 5000, 'test-job');
    // Attach a rejection handler immediately so the eventual rejection isn't
    // reported as unhandled while the fake timer above is still pending.
    const assertion = expect(promise).rejects.toThrow(JobTimeoutError);

    jest.advanceTimersByTime(5000);

    await assertion;
    await expect(promise).rejects.toThrow('test-job exceeded its 5000ms job-level timeout');
  });
});
