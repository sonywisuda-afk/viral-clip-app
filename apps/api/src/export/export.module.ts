import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [QueueModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
