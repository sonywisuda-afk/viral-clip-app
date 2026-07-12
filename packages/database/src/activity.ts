import type { ActivityEventType, Prisma, PrismaClient } from './generated/prisma/client';

// Inserts one ActivityEvent row - the Dashboard's user-facing activity feed
// (Sprint 1-2, Dashboard Redesign). Distinct from video-status.ts's
// VideoStatusEvent, which is an internal pipeline audit trail keyed on
// Video.status transitions alone - this is a coarser feed of things the
// Dashboard shows ("Video uploaded", "Clip generated", ...), written from a
// handful of call sites (VideosService, render-clip.worker.ts,
// ClipsController's download route, TeamService's invite endpoint). Takes
// any Prisma client-shaped object (a real PrismaClient, or a `tx`) so
// callers can compose this into their own transaction the same way
// recordVideoStatusEvent does.
export async function recordActivityEvent(
  prisma: Pick<PrismaClient, 'activityEvent'>,
  params: {
    userId: string;
    type: ActivityEventType;
    videoId?: string;
    clipId?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await prisma.activityEvent.create({
    data: {
      userId: params.userId,
      type: params.type,
      videoId: params.videoId ?? null,
      clipId: params.clipId ?? null,
      metadata: params.metadata ?? undefined,
    },
  });
}
