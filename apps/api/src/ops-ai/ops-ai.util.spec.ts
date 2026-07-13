import { computeAiHealth, computeReadinessVerdict, MIN_SAMPLES_FOR_TRAINING } from './ops-ai.util';

describe('computeAiHealth', () => {
  it('counts low/high confidence clips and missing explainability among clips with a score', () => {
    const result = computeAiHealth([
      { highlightScore: 80, highlightConfidence: 0.9, hasExplainability: true },
      { highlightScore: 40, highlightConfidence: 0.3, hasExplainability: true },
      { highlightScore: 60, highlightConfidence: 0.6, hasExplainability: false },
      { highlightScore: null, highlightConfidence: null, hasExplainability: false },
    ]);

    expect(result.totalClipsWithScore).toBe(3);
    expect(result.highConfidenceClips).toBe(1);
    expect(result.lowConfidenceClips).toBe(1);
    expect(result.missingExplainability).toBe(1);
    expect(result.averageConfidence).toBeCloseTo((0.9 + 0.3 + 0.6) / 3);
  });

  it('returns null averageConfidence and all-zero counts when nothing has a score', () => {
    const result = computeAiHealth([]);
    expect(result.totalClipsWithScore).toBe(0);
    expect(result.averageConfidence).toBeNull();
    expect(result.lowConfidenceClips).toBe(0);
    expect(result.highConfidenceClips).toBe(0);
  });
});

describe('computeReadinessVerdict', () => {
  it('is not ready and lists a sample-count blocker below the training floor', () => {
    const result = computeReadinessVerdict({
      usableSamples: 5,
      drift: { insufficientData: true },
      featureCompleteness: [],
    });

    expect(result.ready).toBe(false);
    expect(result.usableSamples).toBe(5);
    expect(result.minSamplesRequired).toBe(MIN_SAMPLES_FOR_TRAINING);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toMatch(/below the/);
  });

  it('adds a drift blocker when features have drifted', () => {
    const result = computeReadinessVerdict({
      usableSamples: 500,
      drift: {
        insufficientData: false,
        entries: [
          {
            feature: 'audio.loudness',
            meanEarlier: 1,
            meanLater: 2,
            relativeDeltaPct: 100,
            drifted: true,
          },
        ],
      },
      featureCompleteness: [],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes('drift'))).toBe(true);
  });

  it('adds a completeness blocker when a feature is missing in >80% of clips', () => {
    const result = computeReadinessVerdict({
      usableSamples: 500,
      drift: { insufficientData: true },
      featureCompleteness: [
        {
          feature: 'composition.ruleOfThirdsScore',
          presentCount: 10,
          missingCount: 490,
          missingRatePct: 98,
        },
      ],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers.some((b) => b.includes('missing in >80%'))).toBe(true);
  });

  it('is ready with no blockers when every check passes', () => {
    const result = computeReadinessVerdict({
      usableSamples: 500,
      drift: { insufficientData: false, entries: [] },
      featureCompleteness: [
        { feature: 'audio.loudness', presentCount: 500, missingCount: 0, missingRatePct: 0 },
      ],
    });

    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});
