import type { EnqueueDeliveryFn } from '@speedora/database';
import { QueueName, NOTIFICATION_DELIVERY_RETRY_OPTIONS } from '@speedora/shared';
import { notificationDeliveryQueue } from './queues';

// Milestone 04d - the deps.enqueueDelivery counterpart to
// notificationPublisher.ts's deps.publish, for apps/worker's 4 direct
// recordNotification() call sites (video-status.ts's 4 pipeline-stage-worker
// callers, alert-engine.worker.ts). Retry lives on the job options here
// (BullMQ), not app-level logic - same convention as PUBLISH_RETRY_OPTIONS.
export const enqueueNotificationDelivery: EnqueueDeliveryFn = async (event) => {
  await notificationDeliveryQueue.add(QueueName.NOTIFICATION_DELIVERY, event, {
    attempts: NOTIFICATION_DELIVERY_RETRY_OPTIONS.attempts,
    backoff: NOTIFICATION_DELIVERY_RETRY_OPTIONS.backoff,
  });
};
