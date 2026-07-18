import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PublishStatus,
  recordAuditLog,
  WorkspaceRole,
  type Campaign,
  type PublishRecord as PublishRecordRow,
  type SocialAccount as SocialAccountRow,
} from '@speedora/database';
import type { CampaignDetailDto, CampaignDto, CampaignProgress } from '@speedora/shared';
import { CampaignStatus } from '@speedora/shared';
import { toSharedPublishRecord } from '../social/publish-record.util';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { computeCampaignStatus } from './campaign-status.util';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';

type JobSummaryInput = Pick<PublishRecordRow, 'status' | 'clipId'> & {
  socialAccount: Pick<SocialAccountRow, 'platform'>;
};

function summarize(
  cancelledAt: Date | null,
  jobs: JobSummaryInput[],
): { status: CampaignStatus; clipCount: number; platformCount: number; progress: CampaignProgress } {
  return {
    status: computeCampaignStatus(cancelledAt, jobs),
    clipCount: new Set(jobs.map((j) => j.clipId)).size,
    platformCount: new Set(jobs.map((j) => j.socialAccount.platform)).size,
    progress: {
      total: jobs.length,
      published: jobs.filter((j) => j.status === PublishStatus.PUBLISHED).length,
      failed: jobs.filter((j) => j.status === PublishStatus.FAILED).length,
    },
  };
}

function toDto(campaign: Campaign, jobs: JobSummaryInput[]): CampaignDto {
  return {
    id: campaign.id,
    workspaceId: campaign.workspaceId,
    name: campaign.name,
    description: campaign.description,
    tag: campaign.tag,
    startDate: campaign.startDate.toISOString(),
    endDate: campaign.endDate.toISOString(),
    createdById: campaign.createdById,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    ...summarize(campaign.cancelledAt, jobs),
  };
}

// Publishing Expansion Phase 6 (Scheduling). Same EDITOR-to-create/ADMIN-
// to-cancel role split as ProjectService's create/delete, and the same
// "log create/cancel, not every plain edit" audit posture. Status is never
// stored - see campaign-status.util.ts's own comment for why.
@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateCampaignDto): Promise<CampaignDto> {
    await this.access.assertMinRole(userId, workspaceId, WorkspaceRole.EDITOR);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
        tag: dto.tag ?? null,
        startDate,
        endDate,
        createdById: userId,
      },
    });

    await recordAuditLog(this.prisma, {
      workspaceId,
      action: 'CAMPAIGN_CREATED',
      actorId: userId,
      targetType: 'Campaign',
      targetId: campaign.id,
      metadata: { name: dto.name },
    }).catch(() => {});

    return toDto(campaign, []);
  }

  async listByWorkspace(userId: string, workspaceId: string): Promise<{ campaigns: CampaignDto[] }> {
    await this.access.assertMinRole(userId, workspaceId, WorkspaceRole.VIEWER);
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        publishRecords: { select: { status: true, clipId: true, socialAccount: { select: { platform: true } } } },
      },
    });
    return { campaigns: campaigns.map((c) => toDto(c, c.publishRecords)) };
  }

  private async findOrThrow(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }
    return campaign;
  }

  async get(userId: string, id: string): Promise<CampaignDetailDto> {
    const campaign = await this.findOrThrow(id);
    await this.access.assertMinRole(userId, campaign.workspaceId, WorkspaceRole.VIEWER);
    const jobs = await this.prisma.publishRecord.findMany({
      where: { campaignId: id },
      include: { socialAccount: true },
      orderBy: { createdAt: 'desc' },
    });
    return { ...toDto(campaign, jobs), publishRecords: jobs.map(toSharedPublishRecord) };
  }

  async update(userId: string, id: string, dto: UpdateCampaignDto): Promise<CampaignDto> {
    const campaign = await this.findOrThrow(id);
    await this.access.assertMinRole(userId, campaign.workspaceId, WorkspaceRole.EDITOR);

    const startDate = dto.startDate ? new Date(dto.startDate) : campaign.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : campaign.endDate;
    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { name: dto.name, description: dto.description, tag: dto.tag, startDate, endDate },
      include: {
        publishRecords: { select: { status: true, clipId: true, socialAccount: { select: { platform: true } } } },
      },
    });
    return toDto(updated, updated.publishRecords);
  }

  // Cancels the campaign and any of its jobs that haven't fired yet - same
  // "SCHEDULED only, hard delete" semantics as
  // ClipsService.cancelScheduledPublish, applied in bulk. A job already
  // QUEUED/PUBLISHING/PUBLISHED/FAILED is left alone, same reasoning as the
  // per-clip cancel: it's either already been handed to the worker or
  // finished, and cancelling here wouldn't stop/undo it.
  async cancel(userId: string, id: string): Promise<CampaignDto> {
    const campaign = await this.findOrThrow(id);
    await this.access.assertMinRole(userId, campaign.workspaceId, WorkspaceRole.ADMIN);

    await this.prisma.publishRecord.deleteMany({
      where: { campaignId: id, status: PublishStatus.SCHEDULED },
    });
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { cancelledAt: new Date() },
      include: {
        publishRecords: { select: { status: true, clipId: true, socialAccount: { select: { platform: true } } } },
      },
    });

    await recordAuditLog(this.prisma, {
      workspaceId: campaign.workspaceId,
      action: 'CAMPAIGN_CANCELLED',
      actorId: userId,
      targetType: 'Campaign',
      targetId: id,
      metadata: { name: campaign.name },
    }).catch(() => {});

    return toDto(updated, updated.publishRecords);
  }

  // Used by ClipsService.publish() when a clip is queued with a
  // campaignId - validates the campaign exists, belongs to the clip's own
  // workspace, and isn't cancelled. No role check here - ClipsService
  // already asserted EDITOR on the clip's own workspace before calling
  // this.
  async assertUsableForQueue(workspaceId: string, campaignId: string): Promise<void> {
    const campaign = await this.findOrThrow(campaignId);
    if (campaign.workspaceId !== workspaceId) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    if (campaign.cancelledAt) {
      throw new BadRequestException(`Campaign ${campaignId} is cancelled`);
    }
  }
}
