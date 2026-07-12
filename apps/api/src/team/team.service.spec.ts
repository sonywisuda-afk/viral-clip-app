import { PendingInviteRole } from '@speedora/shared';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;
  let prisma: {
    pendingInvite: { create: jest.Mock; findMany: jest.Mock };
    activityEvent: { create: jest.Mock };
  };
  let mailService: { sendTeamInviteEmail: jest.Mock };

  beforeEach(() => {
    prisma = {
      pendingInvite: { create: jest.fn(), findMany: jest.fn() },
      activityEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    mailService = { sendTeamInviteEmail: jest.fn().mockResolvedValue(undefined) };
    service = new TeamService(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
    );
  });

  describe('createInvite', () => {
    it('creates a PendingInvite row, sends the invite email, and records a MEMBER_INVITED activity event', async () => {
      const createdAt = new Date('2026-01-01T00:00:00Z');
      prisma.pendingInvite.create.mockResolvedValue({
        id: 'invite-1',
        email: 'friend@example.com',
        role: PendingInviteRole.EDITOR,
        createdAt,
      });

      const result = await service.createInvite('user-1', 'owner@example.com', {
        email: 'friend@example.com',
        role: PendingInviteRole.EDITOR,
      });

      expect(prisma.pendingInvite.create).toHaveBeenCalledWith({
        data: { inviterId: 'user-1', email: 'friend@example.com', role: PendingInviteRole.EDITOR },
      });
      expect(mailService.sendTeamInviteEmail).toHaveBeenCalledWith(
        'friend@example.com',
        'owner@example.com',
        PendingInviteRole.EDITOR,
      );
      expect(prisma.activityEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'MEMBER_INVITED',
          videoId: null,
          clipId: null,
          metadata: { email: 'friend@example.com', role: PendingInviteRole.EDITOR },
        },
      });
      expect(result).toEqual({
        id: 'invite-1',
        email: 'friend@example.com',
        role: PendingInviteRole.EDITOR,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('still returns the created invite even when the activity-event write fails', async () => {
      prisma.pendingInvite.create.mockResolvedValue({
        id: 'invite-1',
        email: 'friend@example.com',
        role: PendingInviteRole.VIEWER,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      prisma.activityEvent.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.createInvite('user-1', 'owner@example.com', {
          email: 'friend@example.com',
          role: PendingInviteRole.VIEWER,
        }),
      ).resolves.toMatchObject({ id: 'invite-1' });
    });
  });

  describe('listInvites', () => {
    it("returns the inviter's own sent invites, newest first", async () => {
      prisma.pendingInvite.findMany.mockResolvedValue([
        {
          id: 'invite-1',
          email: 'friend@example.com',
          role: PendingInviteRole.OWNER,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const result = await service.listInvites('user-1');

      expect(prisma.pendingInvite.findMany).toHaveBeenCalledWith({
        where: { inviterId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        invites: [
          {
            id: 'invite-1',
            email: 'friend@example.com',
            role: PendingInviteRole.OWNER,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      });
    });
  });
});
