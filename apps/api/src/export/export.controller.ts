import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { exportFileInfo, type ExportType } from '@speedora/shared';
import { getObjectStream } from '@speedora/storage';
import type { Response } from 'express';
import type { SafeUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExportDto } from './dto/create-export.dto';
import { ExportService } from './export.service';

// Sprint 03c/03d (Export Center roadmap) - async, video-scoped formats
// (PDF/EXCEL/HIGHLIGHT_REPORT/BRAND_REPORT, all joined the ExportType enum
// with zero route changes here - see exportFileInfo()). The sync formats
// (CSV/JSON/TXT/SRT/VTT) stay on VideosController's :id/export/* routes
// from Sprint 03b - this is a genuinely separate resource (ExportJob),
// not a rename of that one.
@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post()
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateExportDto) {
    return this.exportService.create(user.id, dto);
  }

  // Recent Exports / Persistent Export History - a plain `/export` GET
  // (no path param) never collides with `/export/:id` below, they're
  // structurally different paths. videoId is required (this list is always
  // scoped to one video, unlike AnalyticsController's optional videoId
  // filter) - same manual-parse-not-DTO posture that controller already
  // uses for its own query params.
  @Get()
  async list(@CurrentUser() user: SafeUser, @Query('videoId') videoId?: string) {
    if (!videoId) {
      throw new BadRequestException('videoId query parameter is required');
    }
    const jobs = await this.exportService.listRecent(user.id, videoId);
    return { jobs };
  }

  @Get(':id')
  async poll(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    const job = await this.exportService.findOwnedOrThrow(id, user.id);
    return this.exportService.toDto(job);
  }

  @Get(':id/download')
  async download(@CurrentUser() user: SafeUser, @Param('id') id: string, @Res() res: Response) {
    const job = await this.exportService.findReadyOrThrow(id, user.id);
    const stream = await getObjectStream(job.resultUrl as string);
    // Prisma's own ExportType enum and @speedora/shared's are nominally
    // distinct TS enum types even though they share the same runtime string
    // values (same "narrow via a cast at the one call site that needs it"
    // convention as ExportService.toDto()).
    const { extension, contentType } = exportFileInfo(job.type as unknown as ExportType);

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="video-${job.videoId}-report.${extension}"`,
    );
    stream.pipe(res);
  }
}
