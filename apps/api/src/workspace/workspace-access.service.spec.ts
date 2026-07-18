import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '@speedora/database';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkspaceAccessService } from './workspace-access.service';

describe('WorkspaceAccessService', () => {
  let service: WorkspaceAccessService;
  let prisma: {
    workspaceMembership: { findUnique: jest.Mock };
    video: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      workspaceMembership: { findUnique: jest.fn() },
      video: { findUnique: jest.fn() },
    };
    service = new WorkspaceAccessService(prisma as unknown as PrismaService);
  });

  describe('getRole', () => {
    it('returns the role on a matching membership', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: WorkspaceRole.EDITOR });

      const role = await service.getRole('user-1', 'ws-1');

      expect(prisma.workspaceMembership.findUnique).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'user-1' } },
        select: { role: true },
      });
      expect(role).toBe(WorkspaceRole.EDITOR);
    });

    it('returns null when there is no membership', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue(null);

      await expect(service.getRole('user-1', 'ws-1')).resolves.toBeNull();
    });
  });

  describe('assertMinRole', () => {
    it('resolves with the role when it meets the minimum', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: WorkspaceRole.ADMIN });

      await expect(service.assertMinRole('user-1', 'ws-1', WorkspaceRole.EDITOR)).resolves.toBe(
        WorkspaceRole.ADMIN,
      );
    });

    it('resolves when the role exactly matches the minimum', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: WorkspaceRole.VIEWER });

      await expect(service.assertMinRole('user-1', 'ws-1', WorkspaceRole.VIEWER)).resolves.toBe(
        WorkspaceRole.VIEWER,
      );
    });

    it('throws ForbiddenException when the member is under-ranked', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: WorkspaceRole.VIEWER });

      await expect(
        service.assertMinRole('user-1', 'ws-1', WorkspaceRole.ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when the requester has no membership at all', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.assertMinRole('user-1', 'ws-1', WorkspaceRole.VIEWER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertVideoAccess', () => {
    it('returns the video when the requester has sufficient access', async () => {
      prisma.video.findUnique.mockResolvedValue({ id: 'video-1', workspaceId: 'ws-1' });
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: WorkspaceRole.OWNER });

      const video = await service.assertVideoAccess('user-1', 'video-1', WorkspaceRole.EDITOR);

      expect(prisma.video.findUnique).toHaveBeenCalledWith({ where: { id: 'video-1' } });
      expect(video).toEqual({ id: 'video-1', workspaceId: 'ws-1' });
    });

    it('throws NotFoundException when the video does not exist', async () => {
      prisma.video.findUnique.mockResolvedValue(null);

      await expect(
        service.assertVideoAccess('user-1', 'missing', WorkspaceRole.VIEWER),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.workspaceMembership.findUnique).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester is a member but under-ranked', async () => {
      prisma.video.findUnique.mockResolvedValue({ id: 'video-1', workspaceId: 'ws-1' });
      prisma.workspaceMembership.findUnique.mockResolvedValue({ role: WorkspaceRole.VIEWER });

      await expect(
        service.assertVideoAccess('user-1', 'video-1', WorkspaceRole.ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws NotFoundException when the requester is not a member of the video's workspace", async () => {
      prisma.video.findUnique.mockResolvedValue({ id: 'video-1', workspaceId: 'ws-1' });
      prisma.workspaceMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.assertVideoAccess('outsider', 'video-1', WorkspaceRole.VIEWER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
