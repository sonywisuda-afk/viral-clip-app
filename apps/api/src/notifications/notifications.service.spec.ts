import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('queries the most recent notifications for this user, newest first', async () => {
      const createdAt = new Date('2026-07-17T00:00:00.000Z');
      prisma.notification.findMany.mockResolvedValue([
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'UPLOAD_COMPLETE',
          title: 'Upload selesai',
          body: 'Video Anda berhasil diunggah.',
          videoId: 'video-1',
          clipId: null,
          metadata: null,
          readAt: null,
          createdAt,
        },
      ]);

      const result = await service.list('user-1', 20);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].id).toBe('notif-1');
      expect(result.notifications[0].readAt).toBeNull();
    });

    it('returns an empty list for a user with no notifications', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      expect(await service.list('user-1', 20)).toEqual({ notifications: [] });
    });
  });

  describe('unreadCount', () => {
    it('counts only unread rows for this user', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.unreadCount('user-1');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('markRead', () => {
    it('sets readAt when the notification belongs to the requester', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markRead('notif-1', 'user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { readAt: expect.any(Date) },
      });
    });

    it("throws NotFoundException when no row matched (missing or someone else's)", async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markRead('notif-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('marks every unread row for this user and returns the count', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('toDto', () => {
    it('maps a null readAt to null and a set readAt to an ISO string', () => {
      const createdAt = new Date('2026-07-17T00:00:00.000Z');
      const readAt = new Date('2026-07-17T01:00:00.000Z');

      const unread = service.toDto({
        id: 'notif-1',
        userId: 'user-1',
        type: 'UPLOAD_COMPLETE',
        title: 'Upload selesai',
        body: 'Video Anda berhasil diunggah.',
        videoId: 'video-1',
        clipId: null,
        metadata: null,
        readAt: null,
        createdAt,
      } as never);
      expect(unread.readAt).toBeNull();

      const read = service.toDto({
        id: 'notif-1',
        userId: 'user-1',
        type: 'UPLOAD_COMPLETE',
        title: 'Upload selesai',
        body: 'Video Anda berhasil diunggah.',
        videoId: 'video-1',
        clipId: null,
        metadata: null,
        readAt,
        createdAt,
      } as never);
      expect(read.readAt).toBe(readAt.toISOString());
    });
  });
});
