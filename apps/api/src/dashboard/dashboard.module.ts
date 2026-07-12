import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// AnalyticsModule: exportCsv() reuses AnalyticsService's already-computed
// Overview + Performance data. PrismaService needs no import - it's
// @Global() (prisma.module.ts), same as every other module that only needs
// DB access.
@Module({
  imports: [AnalyticsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
