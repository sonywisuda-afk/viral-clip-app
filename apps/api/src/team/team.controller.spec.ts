import { PendingInviteRole } from '@speedora/shared';
import type { TeamService } from './team.service';
import { TeamController } from './team.controller';

describe('TeamController', () => {
  let controller: TeamController;
  let teamService: { createInvite: jest.Mock; listInvites: jest.Mock };
  const user = { id: 'user-1', email: 'owner@example.com', role: 'CREATOR' as const };

  beforeEach(() => {
    teamService = { createInvite: jest.fn(), listInvites: jest.fn() };
    controller = new TeamController(teamService as unknown as TeamService);
  });

  it('delegates POST invites to TeamService.createInvite with the inviter id/email and dto', async () => {
    const invite = { id: 'invite-1', email: 'friend@example.com', role: PendingInviteRole.EDITOR };
    teamService.createInvite.mockResolvedValue(invite);

    const result = await controller.createInvite(user, {
      email: 'friend@example.com',
      role: PendingInviteRole.EDITOR,
    });

    expect(teamService.createInvite).toHaveBeenCalledWith('user-1', 'owner@example.com', {
      email: 'friend@example.com',
      role: PendingInviteRole.EDITOR,
    });
    expect(result).toBe(invite);
  });

  it('delegates GET invites to TeamService.listInvites with the requesting user', async () => {
    const invites = { invites: [] };
    teamService.listInvites.mockResolvedValue(invites);

    const result = await controller.listInvites(user);

    expect(teamService.listInvites).toHaveBeenCalledWith('user-1');
    expect(result).toBe(invites);
  });
});
