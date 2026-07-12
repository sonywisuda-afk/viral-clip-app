import type { ModelMetadata, TrainingSample } from '@speedora/contracts';
import { computeChecksum } from '../model-registry';
import { serializeModel } from '../model-serialization';
import type { ModelTrainer } from '../interfaces';

export interface MockTrainConfig {
  modelVersion?: string;
  datasetVersion?: string;
  featureVersion?: string;
}

// The one ModelTrainer implementation this milestone ships - a real,
// deterministic average-of-labels baseline (not random), genuinely
// serialized/checksummed via model-serialization.ts/model-registry.ts so
// the whole train -> serialize -> checksum -> register chain is exercised
// end to end with real data flowing through it, even though the "model"
// itself is trivial. `evaluationScore` is deliberately null here - scoring
// a model is ModelEvaluator's job (src/evaluation), not the trainer's.
export class MockModelTrainer implements ModelTrainer {
  async train(
    samples: TrainingSample[],
    config: MockTrainConfig = {},
  ): Promise<{ model: unknown; metadata: ModelMetadata }> {
    const average =
      samples.length === 0 ? 0 : samples.reduce((sum, s) => sum + s.label, 0) / samples.length;
    const model = { type: 'mock-baseline-average', average };
    const serialized = serializeModel(model);

    const metadata: ModelMetadata = {
      modelId: 'mock-baseline',
      modelVersion: config.modelVersion ?? `mock-${samples.length}-samples`,
      createdAt: new Date().toISOString(),
      datasetVersion: config.datasetVersion ?? 'unknown',
      featureVersion: config.featureVersion ?? 'unknown',
      trainingSampleCount: samples.length,
      evaluationScore: null,
      checksum: computeChecksum(serialized),
    };

    return { model, metadata };
  }
}
