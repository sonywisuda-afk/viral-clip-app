import * as path from 'node:path';
import type { LinearRegressionModel } from '@speedora/fusion-ml';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

// Milestone 2B - the real (production) entry point for
// packages/fusion-ml's runFusionV3Pipeline(). "No production model
// trained" is satisfied literally: with 0 usable samples in production
// today (per M1's export-training-dataset.ts and M1.5's
// generate-dataset-report.ts findings), the default (no-flag) run reports
// that honestly and exits, rather than training on nothing. The pipeline
// itself is proven end-to-end by packages/fusion-ml's pipeline.spec.ts -
// this script's job is being the real wiring, not the proof it works.
//
// `--mock` swaps in MockDatasetBuilder + synthetic sample ids, so a
// developer can see one full real run's console output today without
// needing production data.
async function main() {
  const useMock = process.argv.includes('--mock');

  const {
    BaselineLinearModelTrainer,
    BaselineLinearPredictor,
    InMemoryFeatureRegistry,
    InMemoryModelRegistry,
    MockDatasetBuilder,
    MockModelEvaluator,
    runFusionV3Pipeline,
  } = await import('@speedora/fusion-ml');
  const { prisma } = await import('../prisma');
  const { ProductionDatasetBuilder } = await import('../ml/production-dataset-builder');

  const buildPredictor = (model: unknown) =>
    new BaselineLinearPredictor(model as LinearRegressionModel);

  let datasetBuilder;
  let sampleIds: string[];

  if (useMock) {
    console.log(
      '[run-fusion-v3-pipeline] --mock: using MockDatasetBuilder + synthetic sample ids\n',
    );
    datasetBuilder = new MockDatasetBuilder();
    sampleIds = Array.from({ length: 30 }, (_, i) => `mock-clip-${i}`);
  } else {
    const productionBuilder = new ProductionDatasetBuilder(prisma);
    datasetBuilder = productionBuilder;
    sampleIds = await productionBuilder.listAvailableSampleIds();

    if (sampleIds.length === 0) {
      console.log(
        "[run-fusion-v3-pipeline] 0 usable samples in production - matches M1/M1.5's prior findings. " +
          'Not enough data yet to run a real pipeline. Re-run this script as production data ' +
          'accumulates, or run `pnpm --filter @speedora/fusion-ml test` (pipeline.spec.ts) to see the ' +
          'pipeline proven end-to-end today, or run this script with --mock for a full run against ' +
          'synthetic data.',
      );
      await prisma.$disconnect();
      return;
    }
  }

  const result = await runFusionV3Pipeline({
    datasetBuilder,
    sampleIds,
    trainer: new BaselineLinearModelTrainer(),
    buildPredictor,
    evaluator: new MockModelEvaluator(),
    modelRegistry: new InMemoryModelRegistry(),
    featureRegistry: new InMemoryFeatureRegistry(),
  });

  console.log(JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[run-fusion-v3-pipeline] failed:', error);
    process.exit(1);
  });
}
