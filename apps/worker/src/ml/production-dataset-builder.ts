import type { PrismaClient } from '@speedora/database';
import { FUSION_V2_TO_V3_SIGNAL_MAP, type TrainingSample } from '@speedora/contracts';
import type { DatasetBuilder } from '@speedora/fusion-ml';
import { loadUsableSamples, type DatasetRecord } from '../scripts/dataset-lib';

// Milestone 2B - bridges a v2-shaped DatasetRecord (Milestone 1.5's
// apps/worker/src/scripts/dataset-lib.ts) into a v3 TrainingSample. Pure,
// DB-free, exported for direct fixture testing - the DB access lives only
// in ProductionDatasetBuilder below, which calls this per record.
//
// Filters DatasetRecord's `signal.feature` keys to only those whose signal
// is one of the 8 v3 signals (FUSION_V2_TO_V3_SIGNAL_MAP), renamed to v3's
// signal name (facial -> emotion; everything else maps to itself), sorted
// alphabetically for a deterministic, stable feature ordering - a real
// training pipeline needs that ordering to stay identical between training
// and inference, not just named keys.
export function recordToTrainingSample(record: DatasetRecord): TrainingSample | null {
  if (typeof record.engagementScore !== 'number') return null;

  const entries: Array<[string, number]> = [];
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'number') continue;
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) continue;
    const v2Signal = key.slice(0, dotIndex);
    const feature = key.slice(dotIndex + 1);
    const v3Signal = FUSION_V2_TO_V3_SIGNAL_MAP[v2Signal as keyof typeof FUSION_V2_TO_V3_SIGNAL_MAP];
    if (!v3Signal) continue;
    entries.push([`${v3Signal}.${feature}`, value]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));

  return {
    sampleId: `sample-${record.clipId}`,
    featureVector: {
      clipId: record.clipId,
      featureNames: entries.map(([name]) => name),
      values: entries.map(([, value]) => value),
      extractedAt: new Date().toISOString(),
    },
    label: record.engagementScore,
  };
}

// The real (non-mock) DatasetBuilder implementation - constructor-injected
// PrismaClient (ARCHITECTURE.md's dependency-injection philosophy), reusing
// Milestone 1.5's loadUsableSamples() rather than re-querying Postgres
// itself. `listAvailableSampleIds` is adapter-specific, not part of the
// DatasetBuilder interface - callers (e.g. run-fusion-v3-pipeline.ts) use
// it to discover what's available before calling `build()` with specific
// ids, same two-step shape the DatasetBuilder interface itself implies.
export class ProductionDatasetBuilder implements DatasetBuilder {
  constructor(private readonly prisma: PrismaClient) {}

  async listAvailableSampleIds(): Promise<string[]> {
    const dataset = await loadUsableSamples(this.prisma);
    return dataset.filter((r) => typeof r.engagementScore === 'number').map((r) => r.clipId);
  }

  async build(sampleIds: string[]): Promise<TrainingSample[]> {
    const dataset = await loadUsableSamples(this.prisma);
    const byClipId = new Map(dataset.map((r) => [r.clipId, r]));

    const samples: TrainingSample[] = [];
    for (const id of sampleIds) {
      const record = byClipId.get(id);
      if (!record) continue;
      const sample = recordToTrainingSample(record);
      if (sample) samples.push(sample);
    }
    return samples;
  }
}
