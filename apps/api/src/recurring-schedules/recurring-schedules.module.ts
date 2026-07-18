import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RecurringSchedulesController } from './recurring-schedules.controller';
import { RecurringSchedulesService } from './recurring-schedules.service';

@Module({
  imports: [WorkspaceModule, SocialModule],
  controllers: [RecurringSchedulesController],
  providers: [RecurringSchedulesService],
  // ClipsModule (via CampaignsModule/ClipsService) needs
  // RecurringSchedulesService to resolve a schedule's next open slot when
  // a clip is queued against it (see next-slot.util.ts).
  exports: [RecurringSchedulesService],
})
export class RecurringSchedulesModule {}
