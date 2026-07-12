import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

// No `imports` needed - PrismaService is @Global() (prisma.module.ts), same
// as every other module that only needs DB access.
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  // Sprint 1-2 (Dashboard Redesign) - DashboardModule's Export Report reuses
  // getOverview()/getPerformance() rather than re-querying the same data.
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
