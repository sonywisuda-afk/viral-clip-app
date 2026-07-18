import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SocialModule } from '../social/social.module';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';

@Module({
  // SocialModule: ClipsService.publish() needs SocialAccountsService to
  // validate the target account belongs to the requester before enqueueing
  // a publish-clip job (Fase 6b). StorageModule: ClipsService.remove()
  // cleans up a deleted clip's rendered output object. WorkspaceModule:
  // WorkspaceAccessService (Sprint 5A) replaces the old ownerId checks.
  imports: [QueueModule, SocialModule, StorageModule, WorkspaceModule],
  controllers: [ClipsController],
  providers: [ClipsService],
})
export class ClipsModule {}
