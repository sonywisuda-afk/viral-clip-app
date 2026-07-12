import { Module } from '@nestjs/common';
import { OpsAiController } from './ops-ai.controller';
import { OpsAiService } from './ops-ai.service';

// No `imports` needed - PrismaService is @Global() (prisma.module.ts), same
// as AnalyticsModule.
@Module({
  controllers: [OpsAiController],
  providers: [OpsAiService],
})
export class OpsAiModule {}
