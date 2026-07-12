import { Injectable } from '@nestjs/common';
import { PremiumCreditStatus, VideoStatus } from '@speedora/database';
import type { ActivityEventDto, DashboardActivityDto, DashboardStatsDto } from '@speedora/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildDashboardReportCsv } from './dashboard-export.util';

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  // Statistics Row. Every query below is scoped to `ownerId: userId` (or
  // the equivalent nested relation filter), same posture as every other
  // per-user endpoint in this app - run in parallel, same "fetch everything
  // at once" convention as AnalyticsService.getOverview.
  async getStats(userId: string): Promise<DashboardStatsDto> {
    const monthStart = startOfMonth();

    const [
      totalVideos,
      totalClips,
      terminalVideos,
      sourceSizeAgg,
      outputSizeAgg,
      monthlyVideos,
      monthlyClips,
      premiumCreditsThisMonth,
    ] = await Promise.all([
      this.prisma.video.count({ where: { ownerId: userId } }),
      this.prisma.clip.count({ where: { video: { ownerId: userId } } }),
      // Processing time is only meaningful once a video has actually
      // finished (RENDERED) or given up (FAILED) - see VideoStatusEvent's
      // own comment on why the first->last event span is a free proxy for
      // "how long this took," no new aggregation infra needed.
      this.prisma.video.findMany({
        where: { ownerId: userId, status: { in: [VideoStatus.RENDERED, VideoStatus.FAILED] } },
        select: { statusEvents: { orderBy: { createdAt: 'asc' }, select: { createdAt: true } } },
      }),
      this.prisma.video.aggregate({
        where: { ownerId: userId },
        _sum: { sourceSizeBytes: true },
      }),
      this.prisma.clip.aggregate({
        where: { video: { ownerId: userId } },
        _sum: { outputSizeBytes: true },
      }),
      this.prisma.video.count({ where: { ownerId: userId, createdAt: { gte: monthStart } } }),
      this.prisma.clip.count({
        where: { video: { ownerId: userId }, createdAt: { gte: monthStart } },
      }),
      this.prisma.premiumCredit.count({
        where: { userId, status: PremiumCreditStatus.PAID, createdAt: { gte: monthStart } },
      }),
    ]);

    const durations = terminalVideos
      .filter((video) => video.statusEvents.length >= 2)
      .map((video) => {
        const first = video.statusEvents[0].createdAt.getTime();
        const last = video.statusEvents[video.statusEvents.length - 1].createdAt.getTime();
        return (last - first) / 1000;
      });

    return {
      totalVideos,
      totalClips,
      avgProcessingTimeSeconds: average(durations),
      storageUsedBytes:
        (sourceSizeAgg._sum.sourceSizeBytes ?? 0) + (outputSizeAgg._sum.outputSizeBytes ?? 0),
      monthlyVideos,
      monthlyClips,
      premiumCreditsThisMonth,
    };
  }

  // Activity Timeline - newest first, capped by the controller's parsed
  // `limit`. Deliberately a thin read of ActivityEvent as-is (no joins back
  // to Video/Clip for a live title) - `metadata` already carries whatever
  // display context was known at write time (e.g. a video's title), which
  // survives even if the video/clip is later deleted.
  async getActivity(userId: string, limit: number): Promise<DashboardActivityDto> {
    const events = await this.prisma.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      events: events.map(
        (event): ActivityEventDto => ({
          id: event.id,
          // Prisma's ActivityEventType mirrors packages/shared's own
          // (identical string values) - same cast convention as
          // analytics.service.ts's platform/status fields.
          type: event.type as unknown as ActivityEventDto['type'],
          videoId: event.videoId,
          clipId: event.clipId,
          metadata: (event.metadata as unknown as Record<string, unknown> | null) ?? null,
          createdAt: event.createdAt.toISOString(),
        }),
      ),
    };
  }

  // Export Report quick action - reuses AnalyticsService's already-computed
  // Overview + 30-day Performance data rather than a new data pipeline (see
  // buildDashboardReportCsv's own comment).
  async exportCsv(userId: string): Promise<string> {
    const [overview, performance] = await Promise.all([
      this.analytics.getOverview(userId),
      this.analytics.getPerformance(userId, { days: 30 }),
    ]);

    return buildDashboardReportCsv(overview, performance);
  }
}
