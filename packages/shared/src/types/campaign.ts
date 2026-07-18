import type { PublishRecord } from './social';

// Publishing Expansion Phase 6 (Scheduling). Mirrors CampaignStatus in
// packages/database's Prisma schema. Deliberately NOT computed client-side
// - apps/api's CampaignsService derives this from `cancelledAt` + the
// aggregate status of the campaign's publish jobs and sends it as a plain
// field, so the frontend never needs to duplicate that logic.
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// A rollup of how a campaign's publish jobs are progressing - deliberately
// small (no per-platform/per-clip breakdown here) since that's what
// CampaignDetailDto.publishRecords is for.
export interface CampaignProgress {
  total: number;
  published: number;
  failed: number;
}

// API/UI-facing shape for a Campaign - a named group of publish jobs across
// clips/platforms for a coordinated multi-platform launch. Deliberately has
// NO budget/KPI/target reach/ROI/conversion/ad spend/marketing funnel/
// audience segment fields - those belong to a future Marketing Automation /
// Social Media Management suite, not Speedora (explicit product decision).
export interface CampaignDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  tag: string | null;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  clipCount: number;
  platformCount: number;
  progress: CampaignProgress;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignListDto {
  campaigns: CampaignDto[];
}

export interface CampaignDetailDto extends CampaignDto {
  publishRecords: PublishRecord[];
}
