import { fetchThreadsPostStats } from './threads-stats.client';

describe('fetchThreadsPostStats', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches and maps views/likes/replies/reposts to their stat fields', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { name: 'views', values: [{ value: 1234 }] },
          { name: 'likes', values: [{ value: 56 }] },
          { name: 'replies', values: [{ value: 7 }] },
          { name: 'reposts', values: [{ value: 3 }] },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const stats = await fetchThreadsPostStats('threads-token', 'post-1');

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/v1.0/post-1/insights');
    expect(url.searchParams.get('metric')).toBe('views,likes,replies,reposts');
    expect(url.searchParams.get('access_token')).toBe('threads-token');
    expect(stats).toEqual({
      viewCount: 1234,
      likeCount: 56,
      commentCount: 7,
      shareCount: 3,
      watchTimeSeconds: null,
    });
  });

  it('returns null for any metric missing from the response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ name: 'views', values: [{ value: 10 }] }] }),
    }) as unknown as typeof fetch;

    const stats = await fetchThreadsPostStats('threads-token', 'post-1');

    expect(stats).toEqual({
      viewCount: 10,
      likeCount: null,
      commentCount: null,
      shareCount: null,
      watchTimeSeconds: null,
    });
  });

  it('throws with the Threads error message when the request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid metric views' } }),
    }) as unknown as typeof fetch;

    await expect(fetchThreadsPostStats('threads-token', 'post-1')).rejects.toThrow(
      /Invalid metric views/,
    );
  });
});
