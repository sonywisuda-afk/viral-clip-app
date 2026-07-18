import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  // QueueModule: NotificationDeliveryProducer. StorageModule:
  // CommentsService.addAttachment(). WorkspaceModule: WorkspaceAccessService.
  imports: [QueueModule, StorageModule, WorkspaceModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
