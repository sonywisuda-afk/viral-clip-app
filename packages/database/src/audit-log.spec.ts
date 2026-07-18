import { recordAuditLog } from './audit-log';

describe('recordAuditLog', () => {
  it('creates one AuditLogEntry row with targetId/metadata defaulted to null/undefined', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { auditLogEntry: { create } };

    await recordAuditLog(prisma as never, {
      workspaceId: 'ws-1',
      action: 'MEMBER_REMOVED' as never,
      actorId: 'admin-1',
      targetType: 'WorkspaceMembership',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws-1',
        action: 'MEMBER_REMOVED',
        actorId: 'admin-1',
        targetType: 'WorkspaceMembership',
        targetId: null,
        metadata: undefined,
      },
    });
  });

  it('includes targetId/metadata when given', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { auditLogEntry: { create } };

    await recordAuditLog(prisma as never, {
      workspaceId: 'ws-1',
      action: 'VIDEO_DELETED' as never,
      actorId: 'admin-1',
      targetType: 'Video',
      targetId: 'video-1',
      metadata: { title: 'My video' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws-1',
        action: 'VIDEO_DELETED',
        actorId: 'admin-1',
        targetType: 'Video',
        targetId: 'video-1',
        metadata: { title: 'My video' },
      },
    });
  });
});
