import { ExportType } from '@speedora/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateExportDto {
  @IsString()
  videoId!: string;

  // Optional and defaults to PDF in ExportService.create(). Sprint 03d added
  // EXCEL/HIGHLIGHT_REPORT/BRAND_REPORT to the enum with no DTO change - all
  // still videoId-scoped like PDF. ANALYTICS_REPORT deliberately isn't here
  // yet - it's account-wide, not video-scoped (see schema.prisma's own
  // ExportType comment) - a bigger, separate change.
  @IsOptional()
  @IsEnum(ExportType)
  type?: ExportType;
}
