import type { NotificationType, Prisma, PrismaClient } from './generated/prisma/client';

// Inserts one Notification row - see schema.prisma's own comment on why this
// is a separate model from ActivityEvent. Same shape/posture as
// recordActivityEvent: takes any Prisma client-shaped object (a real
// PrismaClient, or a `tx`), never catches/logs on its own - that's the
// caller's job (wrap in .catch(logger.warn) or console.warn), same "never
// let a secondary/notification write break the primary action" discipline
// as every recordActivityEvent call site.
export async function recordNotification(
  prisma: Pick<PrismaClient, 'notification'>,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    videoId?: string;
    clipId?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      videoId: params.videoId ?? null,
      clipId: params.clipId ?? null,
      metadata: params.metadata ?? undefined,
    },
  });
}
