import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole, type Video } from '@speedora/database';
import { PrismaService } from '../prisma/prisma.service';

// Sprint 5A (Collaboration Foundation) - rank order, highest to lowest:
// OWNER > ADMIN > EDITOR > REVIEWER > VIEWER. Exported so callers that need
// to compare two roles directly (e.g. WorkspaceService blocking "demote the
// last OWNER") don't have to duplicate this table.
export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 0,
  [WorkspaceRole.REVIEWER]: 1,
  [WorkspaceRole.EDITOR]: 2,
  [WorkspaceRole.ADMIN]: 3,
  [WorkspaceRole.OWNER]: 4,
};

// The one place workspace-role sufficiency logic lives - every controller
// that used to do an inline `video.ownerId !== requesterId` check now goes
// through this instead. `NotFoundException` when the requester has no
// membership at all (same "don't leak existence" posture the old ownerId
// checks already had - a non-member gets the same 404 whether the
// workspace/video exists or not); `ForbiddenException` only once we know
// they ARE a member but under-ranked for this specific action (e.g. a
// VIEWER hitting a delete route) - that distinction is meaningful to a
// legitimate member, not a leak to an outsider.
@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async assertMinRole(
    userId: string,
    workspaceId: string,
    minRole: WorkspaceRole,
  ): Promise<WorkspaceRole> {
    const role = await this.getRole(userId, workspaceId);
    if (!role) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }
    if (WORKSPACE_ROLE_RANK[role] < WORKSPACE_ROLE_RANK[minRole]) {
      throw new ForbiddenException(`This action requires the ${minRole} role or higher`);
    }
    return role;
  }

  // The workspace new content defaults into when the caller gives no
  // explicit workspaceId (video upload/import, the main video list) -
  // every User has
  // exactly one isPersonal Workspace, created at signup (see AuthService)
  // or backfilled for pre-Sprint-5A rows (see that migration). Throws
  // rather than returning null - a User missing their personal workspace
  // is a data-integrity bug, not a normal 404 case.
  async getPersonalWorkspaceId(userId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId: userId, isPersonal: true },
      select: { id: true },
    });
    if (!workspace) {
      throw new NotFoundException(`No personal workspace found for user ${userId}`);
    }
    return workspace.id;
  }

  // Convenience wrapper for callers that don't already have the video's
  // workspaceId in hand (a fresh findUnique-then-check, same shape as the
  // inline ownerId checks this replaces). Callers that already fetched a
  // narrower Video projection (e.g. a `select` with just a few fields)
  // should call assertMinRole directly with their own row's workspaceId
  // instead of re-fetching the full row here.
  async assertVideoAccess(userId: string, videoId: string, minRole: WorkspaceRole): Promise<Video> {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }
    await this.assertMinRole(userId, video.workspaceId, minRole);
    return video;
  }
}
