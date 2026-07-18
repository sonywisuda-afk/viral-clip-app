import * as Sentry from '@sentry/node';
import { decryptWebhookUrl, NotificationChannel } from '@speedora/database';
import { QueueName, type NotificationDeliveryJobData } from '@speedora/shared';
import { Worker, type Job } from 'bullmq';
import { forStage } from '../logger';
import {
  formatDiscordPayload,
  formatGenericWebhookPayload,
  formatSlackPayload,
} from '../notification-delivery/payload-formatters';
import { prisma } from '../prisma';
import { createRedisConnection } from '../redis';

const logger = forStage('notification-delivery');

const DELIVERY_CHANNELS: NotificationChannel[] = [
  NotificationChannel.SLACK,
  NotificationChannel.DISCORD,
  NotificationChannel.WEBHOOK,
];

const FETCH_TIMEOUT_MS = 10_000;

// Milestone 04d - delivers one already-written Notification row to every
// SLACK/DISCORD/WEBHOOK destination the recipient has both enabled (a
// NotificationPreference row) AND configured (a NotificationWebhook row) -
// the intersection of the two is what actually gets a POST. Deliberately
// does the enabled/configured resolution itself (not recordNotification()),
// so a future 04e TELEGRAM channel is a change only here, never upstream.
//
// One job covers every enabled channel for a notification - if one
// destination's POST fails, the whole job throws and BullMQ retries the
// whole thing, which can re-post to an already-succeeded destination.
// Accepted V1 risk (see the approved plan's "Explicit V1 cuts") - no
// per-channel delivery ledger.
export function createNotificationDeliveryWorker(): Worker<NotificationDeliveryJobData> {
  return new Worker<NotificationDeliveryJobData>(
    QueueName.NOTIFICATION_DELIVERY,
    async (job: Job<NotificationDeliveryJobData>) => {
      const { notificationId } = job.data;
      const notification = await prisma.notification.findUniqueOrThrow({
        where: { id: notificationId },
      });

      const enabledPreferences = await prisma.notificationPreference.findMany({
        where: {
          userId: notification.userId,
          type: notification.type,
          channel: { in: DELIVERY_CHANNELS },
          enabled: true,
        },
        select: { channel: true },
      });
      if (enabledPreferences.length === 0) return;

      const enabledChannels = enabledPreferences.map((p) => p.channel);
      const webhooks = await prisma.notificationWebhook.findMany({
        where: { userId: notification.userId, channel: { in: enabledChannels } },
      });
      if (webhooks.length === 0) return;

      for (const webhook of webhooks) {
        const url = decryptWebhookUrl(webhook.url);
        const payload =
          webhook.channel === NotificationChannel.SLACK
            ? formatSlackPayload(notification)
            : webhook.channel === NotificationChannel.DISCORD
              ? formatDiscordPayload(notification)
              : formatGenericWebhookPayload(notification);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!response.ok) {
          const error = new Error(
            `Notification delivery to ${webhook.channel} failed with status ${response.status}`,
          );
          logger.error(
            'notification delivery failed',
            { notificationId, channel: webhook.channel, status: response.status },
            error,
          );
          Sentry.captureException(error, {
            tags: { notificationId, channel: webhook.channel },
          });
          throw error;
        }
      }

      logger.info('notification delivered', {
        notificationId,
        channels: webhooks.map((w) => w.channel),
      });
    },
    { connection: createRedisConnection() },
  );
}
