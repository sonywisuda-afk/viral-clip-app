import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  NOTIFICATION_DELIVERY_RETRY_OPTIONS,
  QueueName,
  type NotificationDeliveryJobData,
} from '@speedora/shared';
import { Queue } from 'bullmq';

// Milestone 04d - a real @InjectQueue producer (unlike
// NotificationPublisherService's raw ioredis client, this genuinely is a
// BullMQ queue apps/worker consumes), wrapped in one small class purely so
// VideosService's 2 recordNotification() call sites can pass a plain
// `enqueue(event): Promise<void>` function matching EnqueueDeliveryFn's
// shape into `deps.enqueueDelivery`, the same way apps/worker's
// notificationDeliveryEnqueuer.ts does on its side.
@Injectable()
export class NotificationDeliveryProducer {
  constructor(
    @InjectQueue(QueueName.NOTIFICATION_DELIVERY)
    private readonly queue: Queue<NotificationDeliveryJobData>,
  ) {}

  async enqueue(event: NotificationDeliveryJobData): Promise<void> {
    await this.queue.add(QueueName.NOTIFICATION_DELIVERY, event, {
      attempts: NOTIFICATION_DELIVERY_RETRY_OPTIONS.attempts,
      backoff: NOTIFICATION_DELIVERY_RETRY_OPTIONS.backoff,
    });
  }
}
