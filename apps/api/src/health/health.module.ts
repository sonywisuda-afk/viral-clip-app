import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { HealthController } from './health.controller';

@Module({
  // For the Redis reachability check in HealthController - reuses one of
  // QueueModule's already-established BullMQ connections rather than
  // opening a new one just for health checks. QueueModule is a plain
  // (non-dynamic) module already imported elsewhere in the app (VideosModule/
  // ClipsModule), so Nest's DI container gives this the same singleton
  // instance rather than standing up a second one.
  imports: [QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
