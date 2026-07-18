import { CampaignStatus, PublishStatus } from '@speedora/shared';

// Phase 6 (Scheduling) - shared between /campaigns and /campaigns/[id] so
// the label/badge mapping for the server-derived CampaignStatus (see
// CampaignDto) only lives in one place.
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: 'Draft',
  [CampaignStatus.SCHEDULED]: 'Scheduled',
  [CampaignStatus.RUNNING]: 'Running',
  [CampaignStatus.COMPLETED]: 'Completed',
  [CampaignStatus.CANCELLED]: 'Cancelled',
};

export function campaignStatusBadgeVariant(
  status: CampaignStatus,
): 'default' | 'secondary' | 'outline' | 'muted' {
  switch (status) {
    case CampaignStatus.RUNNING:
      return 'default';
    case CampaignStatus.COMPLETED:
      return 'secondary';
    case CampaignStatus.SCHEDULED:
      return 'outline';
    case CampaignStatus.DRAFT:
    case CampaignStatus.CANCELLED:
    default:
      return 'muted';
  }
}

// Job-status labels for a Campaign's publish job list (CampaignDetailDto.
// publishRecords) - same 5 PublishStatus values DashboardClient's own local
// PUBLISH_STATUS_LABELS covers, kept separate since that copy is in
// Indonesian to match the rest of the dashboard, while this campaign view
// is English-labeled like the rest of Phase 6's new pages.
export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  [PublishStatus.SCHEDULED]: 'Scheduled',
  [PublishStatus.QUEUED]: 'Queued',
  [PublishStatus.PUBLISHING]: 'Publishing',
  [PublishStatus.PUBLISHED]: 'Published',
  [PublishStatus.FAILED]: 'Failed',
};
