import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [QueueModule, WorkspaceModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
