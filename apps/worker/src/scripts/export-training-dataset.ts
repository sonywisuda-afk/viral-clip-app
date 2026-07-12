import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from 'dotenv';
import { MIN_SAMPLES_FOR_CORRELATION, loadUsableSamples, pearsonCorrelation } from './dataset-lib';

config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

// Milestone 1 (Dataset & Feedback Loop): the actual "which feature correlates
// with virality" answer the roadmap asks for. check-calibration-coverage.ts
// already established there's a real gap here (0 usable samples as of
// 2026-07-10) - this script is what turns real samples, once they exist,
// into an exportable training dataset plus a first-pass correlation read.
//
// flattenClipFeatures/pearsonCorrelation/loadUsableSamples/
// MIN_SAMPLES_FOR_CORRELATION live in dataset-lib.ts (Milestone 1.5) -
// shared with generate-dataset-report.ts. Re-exported below so
// export-training-dataset.spec.ts (written before the extraction) keeps
// working unchanged.
export { flattenClipFeatures, pearsonCorrelation } from './dataset-lib';

const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, '../../dataset-export.json');

async function main() {
  const { prisma } = await import('../prisma');
  const outputPath = process.argv[2] ?? DEFAULT_OUTPUT_PATH;

  const dataset = await loadUsableSamples(prisma);

  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
  console.log(`Wrote ${dataset.length} record(s) to ${outputPath}`);

  const usableSamples = dataset.filter((r) => typeof r.engagementScore === 'number');
  if (usableSamples.length < MIN_SAMPLES_FOR_CORRELATION) {
    console.log(
      `\nOnly ${usableSamples.length} sample(s) have a non-null engagementScore - below the ` +
        `${MIN_SAMPLES_FOR_CORRELATION}-sample floor for a meaningful correlation read. Not enough ` +
        `data yet; re-run this script as production data accumulates (see ` +
        `check-calibration-coverage.ts for the same "not enough data" pattern).`,
    );
    await prisma.$disconnect();
    return;
  }

  const featureKeys = new Set<string>();
  for (const record of usableSamples) {
    for (const key of Object.keys(record)) {
      if (key === 'clipId' || key === 'engagementScore') continue;
      if (typeof record[key] === 'number') featureKeys.add(key);
    }
  }

  const engagementScores = usableSamples.map((r) => r.engagementScore as number);
  const correlations = [...featureKeys]
    .map((key) => ({
      feature: key,
      correlation: pearsonCorrelation(
        usableSamples.map((r) => (typeof r[key] === 'number' ? (r[key] as number) : null)),
        engagementScores,
      ),
    }))
    .filter((c): c is { feature: string; correlation: number } => c.correlation !== null)
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  console.log(`\n# Feature correlation vs. engagementScore (${usableSamples.length} samples)\n`);
  for (const { feature, correlation } of correlations) {
    console.log(`${correlation.toFixed(3).padStart(7)}  ${feature}`);
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[export-training-dataset] failed:', error);
    process.exit(1);
  });
}
