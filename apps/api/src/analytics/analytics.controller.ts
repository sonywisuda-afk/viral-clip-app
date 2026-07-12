import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SocialPlatform } from '@speedora/database';
import type { SafeUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

// Milestones 5A/5B (Analytics Dashboard). Every route here is per-user,
// ownership-scoped data (never system-wide) - JwtAuthGuard at the class
// level, same convention as ClipsController/VideosController. Not modeled
// on MonitoringModule (docs/monitoring.md), which is deliberately
// unauthenticated/system-wide operational data.
const VALID_DAYS = [7, 30, 90];
const DEFAULT_DAYS = 30;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

// Invalid/missing query params fall back to a sane default rather than
// throwing a 400 - these are display filters, not data-integrity-critical
// input, so a typo'd `?days=abc` degrading to "show the default range"
// is friendlier than an error page.
function parseDays(raw: string | undefined): number {
  const parsed = Number(raw);
  return VALID_DAYS.includes(parsed) ? parsed : DEFAULT_DAYS;
}

function parseLimit(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.round(parsed)));
}

function parsePlatform(raw: string | undefined): SocialPlatform | undefined {
  return raw && (Object.values(SocialPlatform) as string[]).includes(raw)
    ? (raw as SocialPlatform)
    : undefined;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: SafeUser) {
    return this.analyticsService.getOverview(user.id);
  }

  @Get('performance')
  getPerformance(
    @CurrentUser() user: SafeUser,
    @Query('days') days?: string,
    @Query('platform') platform?: string,
  ) {
    return this.analyticsService.getPerformance(user.id, {
      days: parseDays(days),
      platform: parsePlatform(platform),
    });
  }

  @Get('performance/clips')
  getPerformanceClips(
    @CurrentUser() user: SafeUser,
    @Query('days') days?: string,
    @Query('platform') platform?: string,
    @Query('videoId') videoId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getPerformanceClips(user.id, {
      days: parseDays(days),
      platform: parsePlatform(platform),
      videoId: videoId || undefined,
      limit: parseLimit(limit, 50),
    });
  }

  @Get('performance/videos')
  getPerformanceVideos(
    @CurrentUser() user: SafeUser,
    @Query('days') days?: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getPerformanceVideos(user.id, {
      days: parseDays(days),
      platform: parsePlatform(platform),
      limit: parseLimit(limit, 50),
    });
  }
}
