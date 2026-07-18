import * as Sentry from '@sentry/node';
import { PublishStatus } from '@speedora/database';
import { QueueName, type PublishClipJobData, type PublishClipJobResult } from '@speedora/shared';
import { resolveAccessToken } from '@speedora/social';
import { Worker, type Job } from 'bullmq';
import { forStage } from '../logger';
import { prisma } from '../prisma';
import { platformRegistry } from '../publish/platform-registry';
import { createRedisConnection } from '../redis';

const logger = forStage('publish-clip');

export function createPublishClipWorker(): Worker<PublishClipJobData, PublishClipJobResult> {
  return new Worker<PublishClipJobData, PublishClipJobResult>(
    QueueName.PUBLISH_CLIP,
    async (job: Job<PublishClipJobData>) => {
      const { publishRecordId } = job.data;
      // The PublishRecord row (created synchronously by ClipsService.publish()
      // before enqueueing) is the single source of truth for everything this
      // job needs - re-fetched here rather than trusting the job payload, in
      // case clip/account state changed between enqueue and execution.
      const record = await prisma.publishRecord.findUniqueOrThrow({
        where: { id: publishRecordId },
        include: { clip: true, socialAccount: true },
      });

      logger.info('publishing record', { publishRecordId, clipId: record.clipId });

      // Idempotency guard + atomic claim: QUEUED is this job's only valid
      // precondition (see ClipsService.publish and
      // schedule-publish-clip.worker.ts, the only two callers that enqueue
      // this job, both leaving the record QUEUED first). The WHERE-guarded
      // updateMany is the same claim pattern schedule-publish-clip.worker.ts
      // already uses for its own SCHEDULED -> QUEUED transition, reused
      // here for QUEUED -> PUBLISHING - it atomically rules out both a
      // record that's already PUBLISHED/FAILED *and* a concurrent second
      // execution of this same job (BullMQ stalled-job recovery, or two
      // overlapping attempts) racing to publish it twice. Unlike a
      // duplicated transcribe/render job, reprocessing here doesn't just
      // waste compute - it can post the same clip to YouTube/TikTok/
      // Instagram a second time, a user-visible, hard-to-undo duplicate.
      const claim = await prisma.publishRecord.updateMany({
        where: { id: publishRecordId, status: PublishStatus.QUEUED },
        data: { status: PublishStatus.PUBLISHING },
      });
      if (claim.count !== 1) {
        logger.info(
          'record is not QUEUED (already claimed or finished by another execution) - ' +
            'skipping to avoid a duplicate publish',
          { publishRecordId },
        );
        return { publishRecordId, platformPostId: record.platformPostId ?? '' };
      }

      try {
        if (!record.clip.outputUrl) {
          throw new Error(`Clip ${record.clipId} has no rendered output to publish`);
        }

        const platform = record.socialAccount.platform;
        const adapter = platformRegistry[platform];
        const resolved = await resolveAccessToken(record.socialAccount, adapter.oauth);
        if (resolved.refreshed && resolved.updated) {
          // Best-effort cache write, not required for THIS attempt to
          // succeed - resolved.accessToken below is already the real,
          // usable token regardless of whether persisting it succeeds. Not
          // wrapped in one $transaction with the PUBLISHED write further
          // down: a real platform upload (which can take minutes) runs
          // between the two, and holding a DB transaction open across that
          // network call would tie up a connection-pool slot for the
          // upload's whole duration - a worse risk than the narrow,
          // self-healing inconsistency this write failing on its own can
          // cause (the next publish attempt just refreshes again).
          try {
            await prisma.socialAccount.update({
              where: { id: record.socialAccountId },
              data: resolved.updated,
            });
          } catch (error) {
            logger.warn(
              'failed to persist the refreshed access token, continuing with it in-memory ' +
                'for this attempt',
              { publishRecordId },
              error,
            );
          }
        }

        const { platformPostId, logDetail } = await adapter.publish({
          record,
          outputUrl: record.clip.outputUrl,
          accessToken: resolved.accessToken,
        });

        await prisma.publishRecord.update({
          where: { id: publishRecordId },
          data: {
            status: PublishStatus.PUBLISHED,
            platformPostId,
            publishedAt: new Date(),
          },
        });

        logger.info('record published', { publishRecordId, detail: logDetail });
        return { publishRecordId, platformPostId };
      } catch (error) {
        logger.error(
          'record failed',
          { publishRecordId, clipId: record.clipId, attempt: job.attemptsMade + 1 },
          error,
        );
        Sentry.captureException(error, {
          tags: {
            publishRecordId,
            clipId: record.clipId,
            socialAccountId: record.socialAccountId,
          },
        });

        // BullMQ's own attempts+backoff (configured where this job is
        // enqueued - see ClipsService.publish's PUBLISH_RETRY_OPTIONS)
        // handles transient failures automatically; only mark the record
        // FAILED once this was the last attempt, so the UI doesn't show a
        // final failure while a retry is still in flight. attemptsMade
        // reflects attempts completed *before* this one (BullMQ increments
        // it after the processor returns/throws), so attemptsMade + 1 is
        // this attempt's number.
        const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        if (isFinalAttempt) {
          await prisma.publishRecord.update({
            where: { id: publishRecordId },
            data: {
              status: PublishStatus.FAILED,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
        throw error;
      }
    },
    { connection: createRedisConnection() },
  );
}
