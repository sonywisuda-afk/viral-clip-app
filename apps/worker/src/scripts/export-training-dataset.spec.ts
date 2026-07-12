import { flattenClipFeatures, pearsonCorrelation } from './export-training-dataset';

describe('flattenClipFeatures', () => {
  it('flattens highlightBreakdown contributions into signal.feature -> normalizedValue keys', () => {
    const record = flattenClipFeatures({
      id: 'clip-1',
      viralityScore: 80,
      highlightScore: 72,
      highlightConfidence: 0.6,
      highlightBreakdown: [
        { signal: 'audio', feature: 'loudnessRms', normalizedValue: 0.4, weightedContribution: 0 },
        { signal: 'composition', feature: 'ruleOfThirdsScore', normalizedValue: 0.9, weightedContribution: 0 },
      ],
    });

    expect(record).toEqual({
      clipId: 'clip-1',
      viralityScore: 80,
      highlightScore: 72,
      highlightConfidence: 0.6,
      'audio.loudnessRms': 0.4,
      'composition.ruleOfThirdsScore': 0.9,
    });
  });

  it('uses normalizedValue, not weightedContribution, so weight-0 signals still show up', () => {
    const record = flattenClipFeatures({
      id: 'clip-1',
      viralityScore: null,
      highlightScore: null,
      highlightConfidence: null,
      highlightBreakdown: [
        // weight-0 signal: weightedContribution is 0 even though the raw
        // normalized signal isn't - this is the whole point of using
        // normalizedValue for correlation.
        { signal: 'gesture', feature: 'handMovementRate', normalizedValue: 0.75, weightedContribution: 0 },
      ],
    });

    expect(record['gesture.handMovementRate']).toBe(0.75);
  });

  it('omits null top-level scores and handles a missing/non-array breakdown', () => {
    const record = flattenClipFeatures({
      id: 'clip-2',
      viralityScore: null,
      highlightScore: null,
      highlightConfidence: null,
      highlightBreakdown: null,
    });

    expect(record).toEqual({ clipId: 'clip-2' });
  });
});

describe('pearsonCorrelation', () => {
  it('returns 1 for a perfectly positively correlated pair', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
  });

  it('returns -1 for a perfectly negatively correlated pair', () => {
    expect(pearsonCorrelation([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  });

  it('skips pairs where either value is null (pairwise-complete)', () => {
    const result = pearsonCorrelation([1, 2, null, 4], [10, 20, 999, 40]);
    expect(result).toBeCloseTo(1);
  });

  it('returns null when fewer than 2 complete pairs exist', () => {
    expect(pearsonCorrelation([1, null, null], [10, null, null])).toBeNull();
  });

  it('returns null when one variable has zero variance', () => {
    expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBeNull();
  });
});
