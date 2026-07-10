import { readFile } from 'node:fs/promises';
import * as Sentry from '@sentry/node';
import { updateVideoStatus, VideoStatus } from '@speedora/database';
import {
  QueueName,
  type ImportYoutubeJobData,
  type ImportYoutubeJobResult,
} from '@speedora/shared';
import { uploadObject } from '@speedora/storage';
import { Worker, type Job } from 'bullmq';
import { prisma } from '../prisma';
import { transcribeQueue } from '../queues';
import { createRedisConnection } from '../redis';
import { cleanupTempFile, reserveScratchPath } from '../storage';
import { downloadYoutubeVideo } from '../youtube';

// Real percentage from yt-dlp's own --progress-template output (see
// youtube.ts) - never a fabricated/interpolated animation, same "Postgres,
// not BullMQ's job.updateProgress()" reasoning as transcribe.worker.ts's
// reportProgress. Rounded since yt-dlp reports fractional percent
// (e.g. 45.23) but Video.importProgress is an Int column.
async function reportProgress(videoId: string, percent: number): Promise<void> {
  await prisma.video.update({ where: { id: videoId }, data: { importProgress: Math.round(percent) } });
}

export function createImportYoutubeWorker(): Worker<ImportYoutubeJobData, ImportYoutubeJobResult> {
  return new Worker<ImportYoutubeJobData, ImportYoutubeJobResult>(
    QueueName.IMPORT_YOUTUBE,
    async (job: Job<ImportYoutubeJobData>) => {
      const { videoId, url, provider } = job.data;

      // Same orphaned-job guard as transcribe/detect-clips/render-clip
      // workers - a video can be deleted while this job is still queued,
      // and without this check the job would burn a real (possibly large,
      // multi-minute) yt-dlp download before failing on the final
      // prisma.video.update().
      const videoStillExists = await prisma.video.count({ where: { id: videoId } });
      if (videoStillExists === 0) {
        console.log(`[import-youtube] video ${videoId} was deleted - skipping orphaned job`);
        return { videoId, sourceUrl: '' };
      }

      console.log(`[import-youtube] downloading video ${videoId} from ${url}`);

      let downloadPath: string | null = null;

      try {
        // Reset before anything else - a retry re-runs this same job from
        // scratch (VideosService.retry also resets it eagerly so the click
        // itself doesn't show a stale value), and without this a failed
        // attempt's last-reached percentage would otherwise linger.
        await reportProgress(videoId, 0);

        downloadPath = await reserveScratchPath('youtube-import', '.mp4');
        await downloadYoutubeVideo(url, downloadPath, (percent) => {
          // Fire-and-forget - a dropped/delayed progress write is harmless
          // (the next one supersedes it), and awaiting each one would
          // serialize the DB round-trip behind yt-dlp's own progress-event
          // cadence for no benefit. Errors are swallowed for the same
          // reason reportProgress below isn't guarded elsewhere: a failed
          // progress write here must never abort an otherwise-succeeding
          // download.
          reportProgress(videoId, percent).catch(() => {});
        });

        // Keyed by videoId, not a fresh random id - same "one persisted
        // object per domain row" convention as renders/<clipId>.mp4
        // (render-clip.worker.ts). apps/worker is a legitimate second
        // writer of videos/*, alongside StorageService.saveVideo() (apps/api)
        // for a direct upload.
        const buffer = await readFile(downloadPath);
        const sourceUrl = `videos/${videoId}.mp4`;
        await uploadObject(sourceUrl, buffer, 'video/mp4');

        await updateVideoStatus(prisma, videoId, VideoStatus.UPLOADED, {
          data: { sourceUrl, importProgress: null },
        });

        console.log(`[import-youtube] video ${videoId} -> ${sourceUrl}`);

        await transcribeQueue.add(QueueName.TRANSCRIBE, { videoId, sourceUrl, provider });

        return { videoId, sourceUrl };
      } catch (error) {
        console.error(`[import-youtube] video ${videoId} failed:`, error);
        // Tags only - never the URL's page content or any downloaded bytes.
        Sentry.captureException(error, { tags: { videoId } });
        await updateVideoStatus(prisma, videoId, VideoStatus.FAILED, {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        if (downloadPath) await cleanupTempFile(downloadPath);
      }
    },
    { connection: createRedisConnection() },
  );
}
