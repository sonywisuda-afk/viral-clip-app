import { Injectable } from '@nestjs/common';
import { recordActivityEvent } from '@speedora/database';
import type { PendingInviteDto, PendingInviteRole } from '@speedora/shared';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

function toDto(invite: {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
}): PendingInviteDto {
  return {
    id: invite.id,
    email: invite.email,
    // Prisma's PendingInviteRole mirrors packages/shared's own (identical
    // string values) - same cast convention as analytics.service.ts's
    // platform/status fields.
    role: invite.role as unknown as PendingInviteRole,
    createdAt: invite.createdAt.toISOString(),
  };
}

// Sprint 1-2 (Dashboard Redesign) - the Invite Member quick action.
// Deliberately minimal per explicit product direction: no Team/Membership
// schema, no shared video/clip access, no workspace switching, no role
// enforcement anywhere - see PendingInvite's own comment in schema.prisma.
// This is a one-way "we sent an email and logged it" action, not a real
// invitation lifecycle (no accept flow, no status).
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async createInvite(
    inviterId: string,
    inviterEmail: string,
    input: { email: string; role: PendingInviteRole },
  ): Promise<PendingInviteDto> {
    const invite = await this.prisma.pendingInvite.create({
      data: { inviterId, email: input.email, role: input.role },
    });

    await this.mailService.sendTeamInviteEmail(input.email, inviterEmail, input.role);

    // Best-effort, same "a secondary feed's write must never fail the
    // primary action" posture as every other recordActivityEvent call site.
    await recordActivityEvent(this.prisma, {
      userId: inviterId,
      type: 'MEMBER_INVITED',
      metadata: { email: input.email, role: input.role },
    }).catch(() => {
      // The invite itself (create + email) already succeeded by this point
      // - a lost Activity Timeline entry isn't worth failing the request.
    });

    return toDto(invite);
  }

  async listInvites(inviterId: string): Promise<{ invites: PendingInviteDto[] }> {
    const invites = await this.prisma.pendingInvite.findMany({
      where: { inviterId },
      orderBy: { createdAt: 'desc' },
    });

    return { invites: invites.map(toDto) };
  }
}
