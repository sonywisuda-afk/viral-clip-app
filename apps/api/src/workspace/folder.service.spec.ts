import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { WorkspaceAccessService } from './workspace-access.service';
import { FolderService } from './folder.service';

describe('FolderService', () => {
  let service: FolderService;
  let prisma: {
    project: { findUnique: jest.Mock };
    folder: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    auditLogEntry: { create: jest.Mock };
  };
  let access: { assertMinRole: jest.Mock };

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'project-1', workspaceId: 'ws-1' }),
      },
      folder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      auditLogEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    access = { assertMinRole: jest.fn().mockResolvedValue('EDITOR') };

    service = new FolderService(
      prisma as unknown as PrismaService,
      access as unknown as WorkspaceAccessService,
    );
  });

  describe('create', () => {
    it('creates a Folder and records an audit log entry', async () => {
      prisma.folder.create.mockResolvedValue({
        id: 'folder-1',
        projectId: 'project-1',
        parentId: null,
        name: 'Drafts',
        createdAt: new Date('2026-07-18T00:00:00.000Z'),
      });

      const result = await service.create('user-1', 'project-1', { name: 'Drafts' });

      expect(access.assertMinRole).toHaveBeenCalledWith('user-1', 'ws-1', 'EDITOR');
      expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          action: 'FOLDER_CREATED',
          targetId: 'folder-1',
          metadata: { name: 'Drafts', projectId: 'project-1' },
        }),
      });
      expect(result.id).toBe('folder-1');
    });

    it('throws BadRequestException when parentId belongs to a different project', async () => {
      prisma.folder.findUnique.mockResolvedValue({
        id: 'other-folder',
        projectId: 'other-project',
      });

      await expect(
        service.create('user-1', 'project-1', { name: 'Drafts', parentId: 'other-folder' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.folder.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('requires ADMIN+, deletes the folder, and records an audit log entry', async () => {
      prisma.folder.findUnique.mockResolvedValue({
        id: 'folder-1',
        projectId: 'project-1',
        name: 'Drafts',
      });

      await service.remove('admin-1', 'folder-1');

      expect(access.assertMinRole).toHaveBeenCalledWith('admin-1', 'ws-1', 'ADMIN');
      expect(prisma.folder.delete).toHaveBeenCalledWith({ where: { id: 'folder-1' } });
      expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'FOLDER_DELETED',
          targetId: 'folder-1',
          metadata: { name: 'Drafts' },
        }),
      });
    });

    it('throws NotFoundException for a missing folder', async () => {
      prisma.folder.findUnique.mockResolvedValue(null);

      await expect(service.remove('admin-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
