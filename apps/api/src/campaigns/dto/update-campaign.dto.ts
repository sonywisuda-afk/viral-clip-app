import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// No `status` field - it's derived, not settable (see CampaignsService's
// computeCampaignStatus()). Cancelling a campaign is its own endpoint
// (POST /campaigns/:id/cancel), not a status value set through here.
export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
