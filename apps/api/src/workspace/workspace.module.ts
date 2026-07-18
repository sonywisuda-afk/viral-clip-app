import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { QueueModule } from '../queue/queue.module';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';
import { InvitesController } from './invites.controller';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  // MailModule: invite emails. QueueModule: NotificationDeliveryProducer
  // (Milestone 04f's MEMBER_INVITATION_ACCEPTED). NotificationPublisherService
  // comes from the @Global() RedisPubSubModule, no explicit import needed.
  imports: [MailModule, QueueModule],
  controllers: [WorkspaceController, InvitesController, ProjectController, FolderController],
  providers: [WorkspaceAccessService, WorkspaceService, ProjectService, FolderService],
  exports: [WorkspaceAccessService],
})
export class WorkspaceModule {}
