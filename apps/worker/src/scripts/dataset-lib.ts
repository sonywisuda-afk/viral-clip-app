import type { PrismaClient } from '@speedora/database';

// Milestone 5C-B: flattenClipFeatures/pearsonCorrelation/MIN_SAMPLES_FOR_CORRELATION/
// DatasetRecord/TimestampedRecord moved to @speedora/dataset-quality so
// apps/api's new AI Operations Dashboard (GET /ops/ai/*) can reuse the exact
// same, already-tested logic without importing across apps (apps only talk
// over HTTP/queue). Re-exported here under their original names so
// export-training-dataset.ts/generate-dataset-report.ts/
// production-dataset-builder.ts and their existing specs keep working
// unmodified - only loadClipsWithFeatures/loadUsableSamples (Prisma-
// dependent, so they can't move into a pure package) stay local to this app.
import {
  flattenClipFeatures,
  pearsonCorrelation,
  MIN_SAMPLES_FOR_CORRELATION,
  type DatasetRecord,
  type TimestampedRecord,
} from '@speedora/dataset-quality';

export { flattenClipFeatures, pearsonCorrelation, MIN_SAMPLES_FOR_CORRELATION };
export type { DatasetRecord, TimestampedRecord };

const CLIP_SELECT = {
  id: true,
  viralityScore: true,
  highlightScore: true,
  highlightConfidence: true,
  highlightBreakdown: true,
} as const;

// Tier 1: every clip the Fusion Engine has computed features for, regardless
// of publish/engagement status. Used by the M1.5 quality sections (missing
// data, distribution, drift) - these are useful the moment clips render,
// long before any of them are published or accumulate engagement history.
export async function loadClipsWithFeatures(prisma: PrismaClient): Promise<TimestampedRecord[]> {
  // Same `not: null as never` cast check-calibration-coverage.ts uses for
  // Json? column filters - Prisma's typing is ambiguous between "column is
  // SQL NULL" and "JSON null value" here.
  const clips = await prisma.clip.findMany({
    where: { highlightBreakdown: { not: null as never } },
    select: { ...CLIP_SELECT, createdAt: true },
  });
  return clips.map((c) => ({ record: flattenClipFeatures(c), createdAt: c.createdAt }));
}

// Tier 2: clips joined against their latest engagement snapshot -
// export-training-dataset.ts's dataset, factored out so
// generate-dataset-report.ts's Correlation/Weight Calibration sections use
// the exact same join. A clip can have multiple PublishRecords (one per
// platform) - the most-recently-captured snapshot across all of them is
// used as that clip's outcome row.
export async function loadUsableSamples(prisma: PrismaClient): Promise<DatasetRecord[]> {
  const clips = await prisma.clip.findMany({
    where: { publishRecords: { some: { statsSnapshots: { some: {} } } } },
    select: {
      ...CLIP_SELECT,
      publishRecords: {
        select: {
          statsSnapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  const dataset: DatasetRecord[] = [];
  for (const clip of clips) {
    const latestSnapshot = clip.publishRecords
      .flatMap((r) => r.statsSnapshots)
      .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
    if (!latestSnapshot) continue;

    dataset.push({
      ...flattenClipFeatures(clip),
      viewCount: latestSnapshot.viewCount,
      likeCount: latestSnapshot.likeCount,
      commentCount: latestSnapshot.commentCount,
      shareCount: latestSnapshot.shareCount,
      watchTimeSeconds: latestSnapshot.watchTimeSeconds,
      engagementScore: latestSnapshot.engagementScore,
    });
  }
  return dataset;
}
