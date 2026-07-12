// Moved verbatim from apps/worker/src/scripts/dataset-lib.ts in Milestone
// 5C-B - the pure "flatten a Clip's Fusion Engine features into a
// DatasetRecord" logic apps/worker's export-training-dataset.ts (M1) and
// generate-dataset-report.ts (M1.5) both depend on, now also used by
// apps/api's ops-ai module. dataset-lib.ts keeps its own
// loadClipsWithFeatures/loadUsableSamples (Prisma-dependent, so they can't
// move here) but re-exports this and everything else in this package under
// their old names, so nothing importing from dataset-lib.ts needed to change.
//
// Deliberately uses each Fusion Engine contribution's `normalizedValue`
// (0-1, comparable across features), not `weightedContribution` - the
// weight-0 signals (composition, gesture, faceGeometry, sceneMotion,
// cameraMotion, speaker, object - see docs/ai/fusion.md) would always
// contribute 0 to weightedContribution, which would make it impossible to
// ever discover they deserve a real weight. normalizedValue is exactly the
// pre-weighting signal calibration needs.

interface FusionContribution {
  signal: string;
  feature: string;
  normalizedValue: number;
}

export interface DatasetRecord {
  clipId: string;
  [featureKey: string]: string | number | null;
}

// Pure - the per-clip feature flattening both scripts join against outcome
// metrics (or, for generate-dataset-report.ts's quality sections, use on
// their own with no outcome join at all). Exported for direct fixture
// testing without needing a real Clip row.
export function flattenClipFeatures(clip: {
  id: string;
  viralityScore: number | null;
  highlightScore: number | null;
  highlightConfidence: number | null;
  highlightBreakdown: unknown;
}): DatasetRecord {
  const record: DatasetRecord = { clipId: clip.id };
  if (clip.viralityScore !== null) record.viralityScore = clip.viralityScore;
  if (clip.highlightScore !== null) record.highlightScore = clip.highlightScore;
  if (clip.highlightConfidence !== null) record.highlightConfidence = clip.highlightConfidence;

  const contributions = Array.isArray(clip.highlightBreakdown)
    ? (clip.highlightBreakdown as FusionContribution[])
    : [];
  for (const c of contributions) {
    if (typeof c.normalizedValue !== 'number') continue;
    record[`${c.signal}.${c.feature}`] = c.normalizedValue;
  }
  return record;
}

// A DatasetRecord's index signature (`[featureKey: string]: string | number | null`)
// can't hold a `createdAt: Date` property directly (TS would reject that as
// an index-signature violation on any object literal contextually typed as
// the intersection) - wrapping instead of intersecting sidesteps that.
export interface TimestampedRecord {
  record: DatasetRecord;
  createdAt: Date;
}
