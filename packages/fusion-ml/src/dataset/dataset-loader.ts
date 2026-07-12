import type { TrainingSample } from '@speedora/contracts';
import { FUSION_V3_SIGNALS } from '@speedora/contracts';

// Reads training samples from wherever a real dataset lives (a real
// implementation would wrap Milestone 1.5's loadUsableSamples() output,
// reshaped into TrainingSample - see interfaces.ts's DatasetBuilder
// comment). Kept generic (sampleIds in, samples out) so it isn't tied to
// Postgres or any one storage backend.
export interface DatasetLoader {
  load(sampleIds: string[], deps?: unknown): Promise<TrainingSample[]>;
}

// Deterministic fixture generator - "training may use mock data" per this
// milestone's explicit scope. One feature value per FUSION_V3_SIGNALS
// entry, deterministic (seeded by index, not Math.random()) so tests that
// use it stay reproducible.
export function loadMockDataset(count: number): TrainingSample[] {
  const samples: TrainingSample[] = [];
  for (let i = 0; i < count; i++) {
    const values = FUSION_V3_SIGNALS.map((_, signalIndex) => {
      // Deterministic pseudo-value in [0, 1], varying by both sample and
      // signal index so no two features/samples are identical.
      const seed = (i + 1) * 31 + signalIndex * 7;
      return Math.abs(Math.sin(seed));
    });
    samples.push({
      sampleId: `mock-sample-${i}`,
      featureVector: {
        clipId: `mock-clip-${i}`,
        featureNames: [...FUSION_V3_SIGNALS],
        values,
        extractedAt: new Date(0).toISOString(),
      },
      // Label loosely correlated with the average feature value, so
      // downstream tests (e.g. train/val split, mock trainer) have
      // something non-degenerate to work with.
      label: values.reduce((sum, v) => sum + v, 0) / values.length,
    });
  }
  return samples;
}
