import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@speedora/database';
import type {
  NotificationDto,
  NotificationListDto,
  NotificationUnreadCountDto,
} from '@speedora/shared';
import { PrismaService } from '../prisma/prisma.service';

// Notification Center Sprint 4A - shaped like ExportService: ownership via a
// plain userId filter for lists (a video/notification list that isn't the
// requester's just yields empty, no separate ownership lookup), updateMany +
// count-check for owned single-row mutations (same pattern as
// ClipsService.cancelScheduledPublish/reschedulePublish).
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, limit: number): Promise<NotificationListDto> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { notifications: notifications.map((n) => this.toDto(n)) };
  }

  async unreadCount(userId: string): Promise<NotificationUnreadCountDto> {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  // Compound (id, userId) where, no separate ownership lookup. Not scoped by
  // readAt: null - re-marking an already-read notification just refreshes
  // readAt (idempotent, no false 404 on a double-click).
  async markRead(id: string, userId: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (count === 0) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count };
  }

  toDto(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      type: notification.type as unknown as NotificationDto['type'],
      title: notification.title,
      body: notification.body,
      videoId: notification.videoId,
      clipId: notification.clipId,
      metadata: (notification.metadata as unknown as Record<string, unknown> | null) ?? null,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
