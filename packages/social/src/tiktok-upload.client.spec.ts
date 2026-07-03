import { Readable } from 'node:stream';
import { uploadTikTokVideo } from './tiktok-upload.client';

describe('uploadTikTokVideo', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('inits with source_info sized to the buffered video, then PUTs the bytes to upload_url', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { publish_id: 'publish-1', upload_url: 'https://upload.tiktokapis.com/put-here' },
        }),
      })
      .mockResolvedValueOnce({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const videoStream = Readable.from([Buffer.from('fake video bytes')]);

    const result = await uploadTikTokVideo({ accessToken: 'access-token', videoStream });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
    const initCallBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(initCallBody).toEqual({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: 16,
        chunk_size: 16,
        total_chunk_count: 1,
      },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://upload.tiktokapis.com/put-here',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'video/mp4',
          'Content-Range': 'bytes 0-15/16',
        }),
      }),
    );
    expect(result).toEqual({ publishId: 'publish-1' });
  });

  it('throws with the error details when init fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'access_token_invalid', message: 'bad token' } }),
    }) as unknown as typeof fetch;

    await expect(
      uploadTikTokVideo({
        accessToken: 'bad-token',
        videoStream: Readable.from([Buffer.from('x')]),
      }),
    ).rejects.toThrow(/access_token_invalid/);
  });

  it('throws when the init response is missing publish_id/upload_url', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    }) as unknown as typeof fetch;

    await expect(
      uploadTikTokVideo({
        accessToken: 'access-token',
        videoStream: Readable.from([Buffer.from('x')]),
      }),
    ).rejects.toThrow(/inbox\/video\/init failed/);
  });

  it('throws when the PUT upload fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { publish_id: 'publish-1', upload_url: 'https://upload.tiktokapis.com/put-here' },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'server error',
      }) as unknown as typeof fetch;

    await expect(
      uploadTikTokVideo({
        accessToken: 'access-token',
        videoStream: Readable.from([Buffer.from('x')]),
      }),
    ).rejects.toThrow(/video upload PUT failed/);
  });
});
