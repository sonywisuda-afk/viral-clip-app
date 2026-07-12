import { recordActivityEvent } from './activity';

describe('recordActivityEvent', () => {
  it('creates one ActivityEvent row with the given type', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { activityEvent: { create } };

    await recordActivityEvent(prisma as never, {
      userId: 'user-1',
      type: 'VIDEO_UPLOADED' as never,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'VIDEO_UPLOADED',
        videoId: null,
        clipId: null,
        metadata: undefined,
      },
    });
  });

  it('includes videoId/clipId/metadata when given', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { activityEvent: { create } };

    await recordActivityEvent(prisma as never, {
      userId: 'user-1',
      type: 'CLIP_GENERATED' as never,
      videoId: 'video-1',
      clipId: 'clip-1',
      metadata: { title: 'My Video' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'CLIP_GENERATED',
        videoId: 'video-1',
        clipId: 'clip-1',
        metadata: { title: 'My Video' },
      },
    });
  });
});
