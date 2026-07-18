import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';
import { InvitesController } from './invites.controller';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [MailModule],
  controllers: [WorkspaceController, InvitesController, ProjectController, FolderController],
  providers: [WorkspaceAccessService, WorkspaceService, ProjectService, FolderService],
  exports: [WorkspaceAccessService],
})
export class WorkspaceModule {}
