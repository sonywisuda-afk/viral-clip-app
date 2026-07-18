import { uploadThreadsVideo } from './threads-upload.client';

describe('uploadThreadsVideo', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('creates a container, polls until FINISHED, then publishes it', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      // 1. create container
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) })
      // 2. first status check - still processing
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'IN_PROGRESS' }) })
      // 3. second status check - finished
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'FINISHED' }) })
      // 4. publish
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'post-1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const resultPromise = uploadThreadsVideo({
      accessToken: 'threads-token',
      threadsUserId: 'threads-user-1',
      videoUrl: 'https://bucket.example.com/renders/clip.mp4?signed=1',
      text: 'My hook\n\n#viral #fyp',
    });

    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5_000);

    const result = await resultPromise;

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://graph.threads.net/v1.0/threads-user-1/threads',
      expect.objectContaining({ method: 'POST' }),
    );
    const createBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(createBody.get('media_type')).toBe('VIDEO');
    expect(createBody.get('video_url')).toBe(
      'https://bucket.example.com/renders/clip.mp4?signed=1',
    );
    expect(createBody.get('text')).toBe('My hook\n\n#viral #fyp');

    const secondStatusUrl = new URL(String(fetchMock.mock.calls[2][0]));
    expect(secondStatusUrl.pathname).toBe('/v1.0/container-1');
    expect(secondStatusUrl.searchParams.get('fields')).toBe('status');

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://graph.threads.net/v1.0/threads-user-1/threads_publish',
      expect.objectContaining({ method: 'POST' }),
    );
    const publishBody = fetchMock.mock.calls[3][1].body as URLSearchParams;
    expect(publishBody.get('creation_id')).toBe('container-1');

    expect(result).toEqual({ threadsPostId: 'post-1' });
  });

  it('throws when the container create fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Media type is not supported' } }),
    }) as unknown as typeof fetch;

    await expect(
      uploadThreadsVideo({
        accessToken: 'threads-token',
        threadsUserId: 'threads-user-1',
        videoUrl: 'https://bucket.example.com/renders/clip.mp4',
        text: 'caption',
      }),
    ).rejects.toThrow(/Media type is not supported/);
  });

  it('throws when the container reports ERROR', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ERROR' }),
      }) as unknown as typeof fetch;

    await expect(
      uploadThreadsVideo({
        accessToken: 'threads-token',
        threadsUserId: 'threads-user-1',
        videoUrl: 'https://bucket.example.com/renders/clip.mp4',
        text: 'caption',
      }),
    ).rejects.toThrow(/did not finish processing \(status: ERROR\)/);
  });

  it('throws when threads_publish fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'FINISHED' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Unknown error' } }),
      }) as unknown as typeof fetch;

    await expect(
      uploadThreadsVideo({
        accessToken: 'threads-token',
        threadsUserId: 'threads-user-1',
        videoUrl: 'https://bucket.example.com/renders/clip.mp4',
        text: 'caption',
      }),
    ).rejects.toThrow(/threads_publish failed/);
  });
});
