import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  // ClipsModule needs CampaignsService to validate a campaignId when a
  // clip is queued against one (see ClipsService.publish()).
  exports: [CampaignsService],
})
export class CampaignsModule {}
