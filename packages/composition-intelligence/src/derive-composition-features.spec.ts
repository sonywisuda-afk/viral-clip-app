import { deriveCompositionFeatures } from './derive-composition-features';

describe('deriveCompositionFeatures', () => {
  it('returns all-null fields when there are no samples', () => {
    const result = deriveCompositionFeatures({ frameSize: null, samples: [] });
    expect(result).toEqual({
      ruleOfThirdsScore: null,
      headroomScore: null,
      leadRoomScore: null,
      centeringScore: null,
      subjectLossRatio: null,
      compositionStability: null,
      framingConsistency: null,
    });
  });

  it('combines every calculateX function into one features object', () => {
    const result = deriveCompositionFeatures({
      frameSize: { width: 1080, height: 1920 },
      samples: [
        {
          t: 0,
          subjectBox: { xCenter: 0.5, yCenter: 0.35, width: 0.3, height: 0.4 },
          subjectTrackId: 1,
          facingYaw: 0,
        },
        {
          t: 1,
          subjectBox: { xCenter: 0.5, yCenter: 0.35, width: 0.3, height: 0.4 },
          subjectTrackId: 1,
          facingYaw: 0,
        },
        { t: 2, subjectBox: null, subjectTrackId: null, facingYaw: null },
      ],
    });

    expect(result.ruleOfThirdsScore).not.toBeNull();
    expect(result.headroomScore).not.toBeNull();
    expect(result.centeringScore).not.toBeNull();
    expect(result.subjectLossRatio).toBeCloseTo(1 / 3);
    // Only one adjacent same-subjectBox pair (t=0/t=1); held frame -> ~0.
    expect(result.compositionStability).toBeCloseTo(0);
    // facingYaw is neutral (0) on every present sample, no direction resolvable.
    expect(result.leadRoomScore).toBeNull();
  });
});
