import { fetchInstagramMediaStats } from './instagram-stats.client';

describe('fetchInstagramMediaStats', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches and maps plays/likes/comments to viewCount/likeCount/commentCount', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { name: 'plays', values: [{ value: 1234 }] },
          { name: 'likes', values: [{ value: 56 }] },
          { name: 'comments', values: [{ value: 7 }] },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const stats = await fetchInstagramMediaStats('page-token', 'media-1');

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/v21.0/media-1/insights');
    expect(url.searchParams.get('metric')).toBe('plays,likes,comments');
    expect(url.searchParams.get('access_token')).toBe('page-token');
    expect(stats).toEqual({ viewCount: 1234, likeCount: 56, commentCount: 7 });
  });

  it('returns null for any metric missing from the response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ name: 'plays', values: [{ value: 10 }] }] }),
    }) as unknown as typeof fetch;

    const stats = await fetchInstagramMediaStats('page-token', 'media-1');

    expect(stats).toEqual({ viewCount: 10, likeCount: null, commentCount: null });
  });

  it('throws with the Graph API error message when the request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid metric plays' } }),
    }) as unknown as typeof fetch;

    await expect(fetchInstagramMediaStats('page-token', 'media-1')).rejects.toThrow(
      /Invalid metric plays/,
    );
  });
});
