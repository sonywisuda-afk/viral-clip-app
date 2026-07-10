import { deriveSceneFeatures } from './derive-features';

describe('deriveSceneFeatures', () => {
  it('returns zero cutCount and the whole clip as one segment when there are no cuts', () => {
    const result = deriveSceneFeatures([], 30);
    expect(result).toEqual({
      cutCount: 0,
      cutsPerMinute: 0,
      averageSegmentSeconds: 30,
      hardCutCount: 0,
      fadeCount: 0,
      dissolveCount: 0,
    });
  });

  it('computes cutsPerMinute normalized to 60 seconds', () => {
    const result = deriveSceneFeatures([10, 20], 30);
    expect(result.cutCount).toBe(2);
    expect(result.cutsPerMinute).toBe(4);
  });

  it('computes averageSegmentSeconds as duration divided by (cutCount + 1)', () => {
    const result = deriveSceneFeatures([10, 20], 30);
    expect(result.averageSegmentSeconds).toBe(10);
  });

  it('returns null cutsPerMinute/averageSegmentSeconds for a zero-duration clip', () => {
    const result = deriveSceneFeatures([1, 2], 0);
    expect(result).toEqual({
      cutCount: 2,
      cutsPerMinute: null,
      averageSegmentSeconds: null,
      hardCutCount: 2,
      fadeCount: 0,
      dissolveCount: 0,
    });
  });

  describe('Batch SC-1 - cut type breakdown', () => {
    it('counts every cut as a hard cut when no cutEvents are supplied', () => {
      const result = deriveSceneFeatures([1, 2, 3], 30);
      expect(result.hardCutCount).toBe(3);
      expect(result.fadeCount).toBe(0);
      expect(result.dissolveCount).toBe(0);
    });

    it('splits hardCutCount/fadeCount/dissolveCount from the supplied cutEvents', () => {
      const result = deriveSceneFeatures([1, 2, 3], 30, [
        { t: 1, type: 'hard_cut' },
        { t: 2, type: 'fade' },
        { t: 3, type: 'dissolve' },
      ]);
      expect(result.hardCutCount).toBe(1);
      expect(result.fadeCount).toBe(1);
      expect(result.dissolveCount).toBe(1);
    });

    it('always sums hardCutCount + fadeCount + dissolveCount to cutCount', () => {
      const result = deriveSceneFeatures([1, 2, 3, 4], 30, [
        { t: 1, type: 'fade' },
        { t: 2, type: 'fade' },
      ]);
      expect(result.hardCutCount + result.fadeCount + result.dissolveCount).toBe(result.cutCount);
    });
  });
});
