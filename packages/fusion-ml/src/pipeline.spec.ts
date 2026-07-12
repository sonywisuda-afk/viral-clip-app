import { BaselineLinearModelTrainer, BaselineLinearPredictor, type LinearRegressionModel } from './baseline/linear-regression';
import { InMemoryFeatureRegistry } from './feature-registry';
import type { DatasetBuilder } from './interfaces';
import { InMemoryModelRegistry } from './model-registry';
import { MockDatasetBuilder } from './mock/mock-dataset-builder';
import { MockModelEvaluator } from './mock/mock-model-evaluator';
import { runFusionV3Pipeline } from './pipeline';

// Milestone 2B's "End-to-End Pipeline Verification" - proves the full
// chain (build -> version -> register feature schema -> split -> train ->
// register model -> evaluate) actually works together, using real (not
// mocked-out) BaselineLinearModelTrainer/BaselineLinearPredictor math and
// real InMemory registries, driven by MockDatasetBuilder since there's no
// production data yet (0 usable samples, per M1/M1.5's findings).
describe('runFusionV3Pipeline', () => {
  it('runs the full chain end-to-end with real output at every stage', async () => {
    const modelRegistry = new InMemoryModelRegistry();
    const featureRegistry = new InMemoryFeatureRegistry();
    const sampleIds = Array.from({ length: 20 }, (_, i) => `clip-${i}`);

    const result = await runFusionV3Pipeline({
      datasetBuilder: new MockDatasetBuilder(),
      sampleIds,
      trainer: new BaselineLinearModelTrainer(),
      buildPredictor: (model) => new BaselineLinearPredictor(model as LinearRegressionModel),
      evaluator: new MockModelEvaluator(),
      modelRegistry,
      featureRegistry,
    });

    expect(result.datasetVersion.sampleCount).toBe(20);
    expect(result.datasetVersion.checksum).toHaveLength(64);

    expect(result.featureSchema.featureNames.length).toBeGreaterThan(0);
    expect(await featureRegistry.get(result.featureSchema.featureVersion)).toEqual(result.featureSchema);

    const registered = await modelRegistry.get(result.modelMetadata.modelVersion);
    expect(registered).not.toBeNull();
    expect(registered!.metadata.datasetVersion).toBe(result.datasetVersion.versionId);
    expect(registered!.metadata.featureVersion).toBe(result.featureSchema.featureVersion);
    expect(registered!.metadata.checksum).toHaveLength(64);

    expect(result.evaluationReport.sampleCount).toBeGreaterThan(0);
    expect(typeof result.evaluationReport.metrics.mse).toBe('number');
  });

  it('throws when the dataset builder returns 0 samples', async () => {
    const emptyBuilder: DatasetBuilder = { build: async () => [] };

    await expect(
      runFusionV3Pipeline({
        datasetBuilder: emptyBuilder,
        sampleIds: [],
        trainer: new BaselineLinearModelTrainer(),
        buildPredictor: (model) => new BaselineLinearPredictor(model as LinearRegressionModel),
        evaluator: new MockModelEvaluator(),
        modelRegistry: new InMemoryModelRegistry(),
        featureRegistry: new InMemoryFeatureRegistry(),
      }),
    ).rejects.toThrow();
  });

  it('falls back to evaluating on the training set when the validation split is empty', async () => {
    // 1 sample * default 0.2 validationRatio rounds to 0 validation samples.
    const result = await runFusionV3Pipeline({
      datasetBuilder: new MockDatasetBuilder(),
      sampleIds: ['clip-0'],
      trainer: new BaselineLinearModelTrainer(),
      buildPredictor: (model) => new BaselineLinearPredictor(model as LinearRegressionModel),
      evaluator: new MockModelEvaluator(),
      modelRegistry: new InMemoryModelRegistry(),
      featureRegistry: new InMemoryFeatureRegistry(),
    });

    expect(result.evaluationReport.sampleCount).toBe(1);
  });
});
