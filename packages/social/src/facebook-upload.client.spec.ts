import { uploadFacebookReel } from './facebook-upload.client';

describe('uploadFacebookReel', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('starts an upload session, hands off the presigned URL, then finishes/publishes it', async () => {
    const fetchMock = jest
      .fn()
      // 1. start
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          video_id: 'video-1',
          upload_url: 'https://rupload.facebook.com/video-upload/v21.0/video-1',
        }),
      })
      // 2. upload handoff via file_url
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      // 3. finish/publish
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await uploadFacebookReel({
      accessToken: 'page-token',
      pageId: 'page-1',
      videoUrl: 'https://bucket.example.com/renders/clip.mp4?signed=1',
      caption: 'My hook\n\n#viral #fyp',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://graph.facebook.com/v21.0/page-1/video_reels',
      expect.objectContaining({ method: 'POST' }),
    );
    const startBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(startBody.get('upload_phase')).toBe('start');

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1];
    expect(uploadUrl).toBe('https://rupload.facebook.com/video-upload/v21.0/video-1');
    expect(uploadInit.headers).toEqual({
      Authorization: 'OAuth page-token',
      file_url: 'https://bucket.example.com/renders/clip.mp4?signed=1',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://graph.facebook.com/v21.0/page-1/video_reels',
      expect.objectContaining({ method: 'POST' }),
    );
    const finishBody = fetchMock.mock.calls[2][1].body as URLSearchParams;
    expect(finishBody.get('upload_phase')).toBe('finish');
    expect(finishBody.get('video_id')).toBe('video-1');
    expect(finishBody.get('video_state')).toBe('PUBLISHED');
    expect(finishBody.get('description')).toBe('My hook\n\n#viral #fyp');

    expect(result).toEqual({ videoId: 'video-1' });
  });

  it('throws when the start phase fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid Page access token' } }),
    }) as unknown as typeof fetch;

    await expect(
      uploadFacebookReel({
        accessToken: 'page-token',
        pageId: 'page-1',
        videoUrl: 'https://bucket.example.com/renders/clip.mp4',
        caption: 'caption',
      }),
    ).rejects.toThrow(/Invalid Page access token/);
  });

  it('throws when the upload handoff fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ video_id: 'video-1', upload_url: 'https://rupload.example.com/x' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'file_url is not reachable' } }),
      }) as unknown as typeof fetch;

    await expect(
      uploadFacebookReel({
        accessToken: 'page-token',
        pageId: 'page-1',
        videoUrl: 'https://bucket.example.com/renders/clip.mp4',
        caption: 'caption',
      }),
    ).rejects.toThrow(/file_url is not reachable/);
  });

  it('throws when the finish/publish phase fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ video_id: 'video-1', upload_url: 'https://rupload.example.com/x' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Unknown error' } }),
      }) as unknown as typeof fetch;

    await expect(
      uploadFacebookReel({
        accessToken: 'page-token',
        pageId: 'page-1',
        videoUrl: 'https://bucket.example.com/renders/clip.mp4',
        caption: 'caption',
      }),
    ).rejects.toThrow(/video_reels finish failed/);
  });
});
