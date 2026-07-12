import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [QueueModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
