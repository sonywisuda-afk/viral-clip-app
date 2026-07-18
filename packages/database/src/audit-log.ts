import type { AuditAction, Prisma, PrismaClient } from './generated/prisma/client';

// Sprint 5F (Audit Log) - inserts one AuditLogEntry row. Same "take any
// Prisma client-shaped object (a real PrismaClient, or a `tx`)" contract as
// recordActivityEvent/recordNotification, so callers can compose this into
// their own transaction. Deliberately a separate helper (not a variant of
// recordActivityEvent) - see AuditLogEntry's own schema comment for why
// this is a third, distinct model rather than a reuse of either existing
// feed. targetId is a plain string reference (not a real FK), same
// "the target may since have been deleted" reasoning as ActivityEvent's
// own videoId/clipId fields.
export async function recordAuditLog(
  prisma: Pick<PrismaClient, 'auditLogEntry'>,
  params: {
    workspaceId: string;
    action: AuditAction;
    actorId: string;
    targetType: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await prisma.auditLogEntry.create({
    data: {
      workspaceId: params.workspaceId,
      action: params.action,
      actorId: params.actorId,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      metadata: params.metadata ?? undefined,
    },
  });
}
