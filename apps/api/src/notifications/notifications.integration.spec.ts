import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// A genuine step up from notifications.controller.spec.ts/
// notifications.service.spec.ts's per-class mocked-service unit tests -
// wires the REAL NotificationsController and REAL NotificationsService
// together through actual NestJS DI, only mocking Prisma at the injection
// boundary. Same shape as export.integration.spec.ts.
describe('Notifications module integration (Controller + Service via real DI)', () => {
  const user = { id: 'user-1', email: 'a@example.com', role: 'CREATOR' as const };

  let controller: NotificationsController;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = moduleRef.get(NotificationsController);
  });

  it('GET /notifications scopes the list to the requester only', async () => {
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

    const result = await controller.list(user, undefined);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    expect(result.notifications).toHaveLength(1);
  });

  it('GET /notifications/unread-count returns the wrapped count', async () => {
    prisma.notification.count.mockResolvedValue(7);

    const result = await controller.unreadCount(user);

    expect(result).toEqual({ count: 7 });
  });

  it('PATCH /notifications/:id/read 404s for a notification owned by a different user', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });

    await expect(controller.markRead(user, 'notif-1')).rejects.toThrow(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', userId: 'user-1' },
      data: { readAt: expect.any(Date) },
    });
  });

  it('PATCH /notifications/read-all marks every unread row for the requester', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await controller.markAllRead(user);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(result).toEqual({ count: 3 });
  });
});
