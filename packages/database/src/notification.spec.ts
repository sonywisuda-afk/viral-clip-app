import { recordNotification } from './notification';

describe('recordNotification', () => {
  it('creates one Notification row with the given type/title/body', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { notification: { create } };

    await recordNotification(prisma as never, {
      userId: 'user-1',
      type: 'UPLOAD_COMPLETE' as never,
      title: 'Upload selesai',
      body: 'Video Anda berhasil diunggah.',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'UPLOAD_COMPLETE',
        title: 'Upload selesai',
        body: 'Video Anda berhasil diunggah.',
        videoId: null,
        clipId: null,
        metadata: undefined,
      },
    });
  });

  it('includes videoId/clipId/metadata when given', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { notification: { create } };

    await recordNotification(prisma as never, {
      userId: 'user-1',
      type: 'RENDER_FAILED' as never,
      title: 'Proses video gagal',
      body: 'Video "My Video" gagal diproses. Silakan coba lagi.',
      videoId: 'video-1',
      clipId: 'clip-1',
      metadata: { errorMessage: 'boom' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'RENDER_FAILED',
        title: 'Proses video gagal',
        body: 'Video "My Video" gagal diproses. Silakan coba lagi.',
        videoId: 'video-1',
        clipId: 'clip-1',
        metadata: { errorMessage: 'boom' },
      },
    });
  });
});
