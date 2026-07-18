import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;
}
