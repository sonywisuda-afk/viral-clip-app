import * as path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

// Milestone 1.5 (Dataset Validation & Calibration): the 7 requested
// deliverables (Dataset Quality Dashboard, Correlation Dashboard, Missing
// Data Report, Feature Distribution, Feature Drift Detection, Weight
// Calibration Report, Dataset Health Report) consolidated into one script -
// the 7th, Dataset Health Report, is the natural rollup of the other 6 plus
// an overall readiness verdict, rather than a separate thing to compute.
// See docs/ai/dataset-validation-calibration.md.
//
// Two data tiers, per dataset-lib.ts:
// - Missing Data / Feature Distribution / Feature Drift run over every clip
//   the Fusion Engine has computed features for, regardless of publish
//   status - useful immediately, not blocked on engagement data.
// - Correlation / Weight Calibration need the engagement-joined subset
//   (same MIN_SAMPLES_FOR_CORRELATION floor as export-training-dataset.ts).

async function main() {
  const { prisma } = await import('../prisma');
  const { DEFAULT_FUSION_WEIGHTS } = await import('@speedora/fusion-engine');
  const {
    loadClipsWithFeatures,
    loadUsableSamples,
    pearsonCorrelation,
    MIN_SAMPLES_FOR_CORRELATION,
  } = await import('./dataset-lib');
  const {
    computeMissingDataReport,
    computeFeatureDistribution,
    detectFeatureDrift,
    computeWeightCalibrationSuggestions,
  } = await import('./dataset-quality');

  const timestamped = await loadClipsWithFeatures(prisma);
  const featureRecords = timestamped.map((t) => t.record);
  const totalClips = featureRecords.length;

  const missingData = computeMissingDataReport(featureRecords, totalClips);
  const distribution = computeFeatureDistribution(featureRecords);
  const drift = detectFeatureDrift(timestamped);

  const usableSamples = await loadUsableSamples(prisma);
  const usableWithEngagement = usableSamples.filter((r) => typeof r.engagementScore === 'number');

  let correlations: Array<{ feature: string; correlation: number }> = [];
  let weightSuggestions: ReturnType<typeof computeWeightCalibrationSuggestions> = [];
  const hasEnoughForCorrelation = usableWithEngagement.length >= MIN_SAMPLES_FOR_CORRELATION;

  if (hasEnoughForCorrelation) {
    const featureKeys = new Set<string>();
    for (const record of usableWithEngagement) {
      for (const key of Object.keys(record)) {
        if (key === 'clipId' || key === 'engagementScore') continue;
        if (typeof record[key] === 'number') featureKeys.add(key);
      }
    }
    const engagementScores = usableWithEngagement.map((r) => r.engagementScore as number);
    correlations = [...featureKeys]
      .map((feature) => ({
        feature,
        correlation: pearsonCorrelation(
          usableWithEngagement.map((r) => (typeof r[feature] === 'number' ? (r[feature] as number) : null)),
          engagementScores,
        ),
      }))
      .filter((c): c is { feature: string; correlation: number } => c.correlation !== null)
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    weightSuggestions = computeWeightCalibrationSuggestions(correlations, DEFAULT_FUSION_WEIGHTS);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalClipsWithFeatures: totalClips,
    usableSamplesForCorrelation: usableWithEngagement.length,
    minSamplesForCorrelation: MIN_SAMPLES_FOR_CORRELATION,
    missingData,
    distribution,
    drift,
    hasEnoughForCorrelation,
    correlations,
    weightSuggestions,
  };

  console.log(renderMarkdown(report));
  console.log('\n--- JSON ---');
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();
}

interface Report {
  generatedAt: string;
  totalClipsWithFeatures: number;
  usableSamplesForCorrelation: number;
  minSamplesForCorrelation: number;
  missingData: ReturnType<typeof import('./dataset-quality').computeMissingDataReport>;
  distribution: ReturnType<typeof import('./dataset-quality').computeFeatureDistribution>;
  drift: ReturnType<typeof import('./dataset-quality').detectFeatureDrift>;
  hasEnoughForCorrelation: boolean;
  correlations: Array<{ feature: string; correlation: number }>;
  weightSuggestions: ReturnType<typeof import('./dataset-quality').computeWeightCalibrationSuggestions>;
}

function healthVerdict(r: Report): string {
  if (r.totalClipsWithFeatures === 0) {
    return 'No clips with computed Fusion Engine features exist yet - nothing to report on.';
  }
  const highMissing = r.missingData.filter((m) => m.missingRatePct > 80);
  const lines: string[] = [];
  if (highMissing.length > 0) {
    lines.push(
      `${highMissing.length} feature(s) are missing in >80% of clips (${highMissing
        .slice(0, 5)
        .map((m) => m.feature)
        .join(', ')}${highMissing.length > 5 ? ', ...' : ''}) - likely detectors with no caller yet or with a low success rate.`,
    );
  }
  if (!r.drift.insufficientData && r.drift.entries.some((e) => e.drifted)) {
    const drifted = r.drift.entries.filter((e) => e.drifted);
    lines.push(
      `${drifted.length} feature(s) show a >25% mean shift between the earlier/later halves of the dataset - worth a manual look before trusting their correlation numbers.`,
    );
  }
  if (!r.hasEnoughForCorrelation) {
    lines.push(
      `Only ${r.usableSamplesForCorrelation} sample(s) have engagement data - below the ${r.minSamplesForCorrelation}-sample floor, so Correlation/Weight Calibration are not yet meaningful.`,
    );
  } else {
    lines.push(
      `${r.usableSamplesForCorrelation} samples have engagement data - Correlation and Weight Calibration below are statistically meaningful (though still first-pass, not a validated model).`,
    );
  }
  return lines.length > 0 ? lines.join(' ') : 'No major issues detected.';
}

function renderMarkdown(r: Report): string {
  return `# Dataset Health Report

Generated: ${r.generatedAt}

## Dataset Quality

- Total clips with computed Fusion Engine features: ${r.totalClipsWithFeatures}
- Usable samples for correlation (engagement data present): ${r.usableSamplesForCorrelation} (floor: ${r.minSamplesForCorrelation})

**Verdict**: ${healthVerdict(r)}

## Missing Data Report

${
  r.missingData.length === 0
    ? '_No clips yet._'
    : `| Feature | Present | Missing | Missing % |\n|---|---|---|---|\n${r.missingData
        .map((m) => `| ${m.feature} | ${m.presentCount} | ${m.missingCount} | ${m.missingRatePct}% |`)
        .join('\n')}`
}

## Feature Distribution

${
  r.distribution.length === 0
    ? '_No numeric feature values yet._'
    : `| Feature | Count | Min | Max | Mean | Median | Stddev | P25 | P75 |\n|---|---|---|---|---|---|---|---|---|\n${r.distribution
        .map(
          (d) =>
            `| ${d.feature} | ${d.count} | ${d.min.toFixed(3)} | ${d.max.toFixed(3)} | ${d.mean.toFixed(3)} | ${d.median.toFixed(3)} | ${d.stddev.toFixed(3)} | ${d.p25.toFixed(3)} | ${d.p75.toFixed(3)} |`,
        )
        .join('\n')}`
}

## Feature Drift Detection

${
  r.drift.insufficientData
    ? `_Insufficient data - fewer than the minimum total records needed to split into earlier/later halves._`
    : r.drift.entries.length === 0
      ? '_No feature had enough samples in both halves to compare._'
      : `| Feature | Mean (earlier) | Mean (later) | Delta % | Drifted? |\n|---|---|---|---|---|\n${r.drift.entries
          .map(
            (d) =>
              `| ${d.feature} | ${d.meanEarlier.toFixed(3)} | ${d.meanLater.toFixed(3)} | ${d.relativeDeltaPct}% | ${d.drifted ? '**yes**' : 'no'} |`,
          )
          .join('\n')}`
}

## Correlation Dashboard

${
  !r.hasEnoughForCorrelation
    ? `_Only ${r.usableSamplesForCorrelation} sample(s) have engagementScore - below the ${r.minSamplesForCorrelation}-sample floor for a meaningful correlation read. Not enough data yet; re-run as production data accumulates._`
    : `| Feature | Correlation vs. engagementScore |\n|---|---|\n${r.correlations
        .map((c) => `| ${c.feature} | ${c.correlation.toFixed(3)} |`)
        .join('\n')}`
}

## Weight Calibration Report

${
  !r.hasEnoughForCorrelation
    ? '_Depends on the Correlation Dashboard above - not enough data yet._'
    : `Heuristic suggestion only - review before touching packages/fusion-engine/src/weights.ts, do not auto-apply.\n\n| Signal | Current Weight | Suggested Weight | Feature Count |\n|---|---|---|---|\n${r.weightSuggestions
        .map((w) => `| ${w.signal} | ${w.currentWeight} | ${w.suggestedWeight} | ${w.sampleFeatureCount} |`)
        .join('\n')}`
}
`;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[generate-dataset-report] failed:', error);
    process.exit(1);
  });
}
