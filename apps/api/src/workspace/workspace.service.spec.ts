import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import type { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prisma: {
    workspace: { create: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    workspaceMembership: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      upsert: jest.Mock;
      count: jest.Mock;
    };
    pendingInvite: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    auditLogEntry: { create: jest.Mock; findMany: jest.Mock };
    activityEvent: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let access: { assertMinRole: jest.Mock; getRole: jest.Mock };
  let mailService: { sendWorkspaceInviteEmail: jest.Mock };

  beforeEach(() => {
    prisma = {
      workspace: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      workspaceMembership: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      pendingInvite: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLogEntry: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn() },
      activityEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    access = {
      assertMinRole: jest.fn().mockResolvedValue('ADMIN'),
      getRole: jest.fn().mockResolvedValue('OWNER'),
    };
    mailService = { sendWorkspaceInviteEmail: jest.fn().mockResolvedValue(undefined) };

    service = new WorkspaceService(
      prisma as unknown as PrismaService,
      access as unknown as WorkspaceAccessService,
      mailService as unknown as MailService,
    );
  });

  describe('create', () => {
    it('creates a Workspace and an OWNER membership for the creator', async () => {
      prisma.workspace.create.mockResolvedValue({
        id: 'ws-1',
        name: 'Acme',
        isPersonal: false,
        createdAt: new Date('2026-07-18T00:00:00.000Z'),
      });

      const result = await service.create('user-1', 'Acme');

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: { name: 'Acme', isPersonal: false, ownerId: 'user-1' },
      });
      expect(prisma.workspaceMembership.create).toHaveBeenCalledWith({
        data: { workspaceId: 'ws-1', userId: 'user-1', role: 'OWNER' },
      });
      expect(result).toMatchObject({ id: 'ws-1', role: 'OWNER', memberCount: 1 });
    });
  });

  describe('createInvite', () => {
    it('creates a PendingInvite, sends the email, and records an audit log entry', async () => {
      prisma.workspace.findUniqueOrThrow.mockResolvedValue({ id: 'ws-1', name: 'Acme' });
      prisma.pendingInvite.create.mockResolvedValue({
        id: 'invite-1',
        workspaceId: 'ws-1',
        email: 'friend@example.com',
        role: 'EDITOR',
        status: 'PENDING',
        createdAt: new Date('2026-07-18T00:00:00.000Z'),
      });

      const result = await service.createInvite(
        'admin-1',
        'admin@example.com',
        'ws-1',
        { email: 'friend@example.com', role: 'EDITOR' as never },
        'https://app.test',
      );

      expect(access.assertMinRole).toHaveBeenCalledWith('admin-1', 'ws-1', 'ADMIN');
      expect(mailService.sendWorkspaceInviteEmail).toHaveBeenCalledWith(
        'friend@example.com',
        'admin@example.com',
        'Acme',
        'EDITOR',
        expect.stringContaining('https://app.test/invites/'),
      );
      expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          action: 'INVITE_CREATED',
          actorId: 'admin-1',
          targetType: 'PendingInvite',
          targetId: 'invite-1',
        }),
      });
      expect(result.id).toBe('invite-1');
    });
  });

  describe('acceptInvite', () => {
    const invite = {
      id: 'invite-1',
      workspaceId: 'ws-1',
      email: 'friend@example.com',
      role: 'EDITOR',
      status: 'PENDING',
      createdAt: new Date(),
      workspace: { name: 'Acme' },
    };

    it('creates the membership, marks the invite accepted, and records an audit log entry', async () => {
      prisma.pendingInvite.findUnique.mockResolvedValue(invite);
      prisma.workspace.findUniqueOrThrow.mockResolvedValue({
        id: 'ws-1',
        name: 'Acme',
        isPersonal: false,
        createdAt: new Date(),
      });

      await service.acceptInvite('user-2', 'friend@example.com', 'raw-token');

      expect(prisma.workspaceMembership.upsert).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'user-2' } },
        create: { workspaceId: 'ws-1', userId: 'user-2', role: 'EDITOR' },
        update: { role: 'EDITOR' },
      });
      expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          action: 'INVITE_ACCEPTED',
          actorId: 'user-2',
          targetId: 'invite-1',
        }),
      });
    });

    it('throws ForbiddenException when the accepting email does not match', async () => {
      prisma.pendingInvite.findUnique.mockResolvedValue(invite);

      await expect(
        service.acceptInvite('user-2', 'someone-else@example.com', 'raw-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the invite is not PENDING', async () => {
      prisma.pendingInvite.findUnique.mockResolvedValue({ ...invite, status: 'REVOKED' });

      await expect(
        service.acceptInvite('user-2', 'friend@example.com', 'raw-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for an unknown token', async () => {
      prisma.pendingInvite.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptInvite('user-2', 'friend@example.com', 'raw-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMemberRole', () => {
    it('updates the role and records an audit log entry with old/new roles', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: 'EDITOR' });

      await service.updateMemberRole('admin-1', 'ws-1', 'user-2', 'REVIEWER' as never);

      expect(prisma.workspaceMembership.update).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'user-2' } },
        data: { role: 'REVIEWER' },
      });
      expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MEMBER_ROLE_CHANGED',
          targetId: 'user-2',
          metadata: { oldRole: 'EDITOR', newRole: 'REVIEWER' },
        }),
      });
    });

    it('throws BadRequestException when demoting the last OWNER', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: 'OWNER' });
      prisma.workspaceMembership.count.mockResolvedValue(1);

      await expect(
        service.updateMemberRole('admin-1', 'ws-1', 'user-2', 'ADMIN' as never),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.workspaceMembership.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target is not a member', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('admin-1', 'ws-1', 'missing-user', 'EDITOR' as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('deletes the membership and records an audit log entry', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: 'EDITOR' });

      await service.removeMember('admin-1', 'ws-1', 'user-2');

      expect(prisma.workspaceMembership.delete).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'user-2' } },
      });
      expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MEMBER_REMOVED',
          targetId: 'user-2',
          metadata: { role: 'EDITOR' },
        }),
      });
    });

    it('throws BadRequestException when removing the last OWNER', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: 'OWNER' });
      prisma.workspaceMembership.count.mockResolvedValue(1);

      await expect(service.removeMember('admin-1', 'ws-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.workspaceMembership.delete).not.toHaveBeenCalled();
    });
  });

  describe('listAuditLog', () => {
    it('requires ADMIN+ and maps entries to DTOs', async () => {
      prisma.auditLogEntry.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'MEMBER_REMOVED',
          actor: { email: 'admin@example.com' },
          targetType: 'WorkspaceMembership',
          targetId: 'user-2',
          metadata: { role: 'EDITOR' },
          createdAt: new Date('2026-07-18T00:00:00.000Z'),
        },
      ]);

      const result = await service.listAuditLog('admin-1', 'ws-1', { limit: 20 });

      expect(access.assertMinRole).toHaveBeenCalledWith('admin-1', 'ws-1', 'ADMIN');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({
        id: 'log-1',
        action: 'MEMBER_REMOVED',
        actorEmail: 'admin@example.com',
      });
      expect(result.nextCursor).toBeNull();
    });

    it('paginates via cursor and reports nextCursor when there are more rows than the limit', async () => {
      prisma.auditLogEntry.findMany.mockResolvedValue([
        {
          id: 'log-2',
          action: 'MEMBER_REMOVED',
          actor: { email: 'a@example.com' },
          targetType: 'WorkspaceMembership',
          targetId: null,
          metadata: null,
          createdAt: new Date(),
        },
        {
          id: 'log-1',
          action: 'MEMBER_REMOVED',
          actor: { email: 'a@example.com' },
          targetType: 'WorkspaceMembership',
          targetId: null,
          metadata: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.listAuditLog('admin-1', 'ws-1', { limit: 1 });

      expect(prisma.auditLogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 }),
      );
      expect(result.entries).toHaveLength(1);
      expect(result.nextCursor).toBe('log-2');
    });
  });
});
