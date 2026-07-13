import type { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: {
    video: { findMany: jest.Mock };
    clip: { findMany: jest.Mock };
    transcriptSegment: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      video: { findMany: jest.fn().mockResolvedValue([]) },
      clip: { findMany: jest.fn().mockResolvedValue([]) },
      transcriptSegment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new SearchService(prisma as unknown as PrismaService);
  });

  it('returns empty results without touching the database for a blank query', async () => {
    const result = await service.search('user-1', '   ');

    expect(result).toEqual({ videos: [], clips: [], transcriptMatches: [] });
    expect(prisma.video.findMany).not.toHaveBeenCalled();
    expect(prisma.clip.findMany).not.toHaveBeenCalled();
    expect(prisma.transcriptSegment.findMany).not.toHaveBeenCalled();
  });

  it('scopes every query to the requesting user and maps rows to the shared DTO shape', async () => {
    prisma.video.findMany.mockResolvedValue([
      { id: 'video-1', title: 'My Cool Video', createdAt: new Date('2026-01-01T00:00:00Z') },
    ]);
    prisma.clip.findMany.mockResolvedValue([
      { id: 'clip-1', videoId: 'video-1', hookText: 'You will not believe', hashtags: ['viral'] },
    ]);
    prisma.transcriptSegment.findMany.mockResolvedValue([
      { videoId: 'video-1', start: 1.5, end: 4.2, text: 'hello world' },
    ]);

    const result = await service.search('user-1', 'hello');

    expect(prisma.video.findMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-1', title: { contains: 'hello', mode: 'insensitive' } },
      select: { id: true, title: true, createdAt: true },
      take: 10,
    });
    expect(prisma.clip.findMany).toHaveBeenCalledWith({
      where: {
        video: { ownerId: 'user-1' },
        OR: [
          { hookText: { contains: 'hello', mode: 'insensitive' } },
          { hashtags: { has: 'hello' } },
        ],
      },
      select: { id: true, videoId: true, hookText: true, hashtags: true },
      take: 10,
    });
    expect(prisma.transcriptSegment.findMany).toHaveBeenCalledWith({
      where: { video: { ownerId: 'user-1' }, text: { contains: 'hello', mode: 'insensitive' } },
      select: { videoId: true, start: true, end: true, text: true },
      take: 10,
    });
    expect(result).toEqual({
      videos: [
        { videoId: 'video-1', title: 'My Cool Video', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      clips: [
        {
          clipId: 'clip-1',
          videoId: 'video-1',
          hookText: 'You will not believe',
          hashtags: ['viral'],
        },
      ],
      transcriptMatches: [{ videoId: 'video-1', start: 1.5, end: 4.2, text: 'hello world' }],
    });
  });

  it('trims surrounding whitespace before querying', async () => {
    await service.search('user-1', '  hello  ');

    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ title: { contains: 'hello', mode: 'insensitive' } }),
      }),
    );
  });
});
