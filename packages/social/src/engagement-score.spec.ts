import { computeEngagementScore } from './engagement-score';

describe('computeEngagementScore', () => {
  it('returns null when viewCount is null', () => {
    expect(
      computeEngagementScore({ viewCount: null, likeCount: 10, commentCount: 2, shareCount: 1 }),
    ).toBeNull();
  });

  it('returns null when viewCount is zero', () => {
    expect(
      computeEngagementScore({ viewCount: 0, likeCount: 10, commentCount: 2, shareCount: 1 }),
    ).toBeNull();
  });

  it('returns zero when there is no engagement at all', () => {
    expect(
      computeEngagementScore({
        viewCount: 1000,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
      }),
    ).toBe(0);
  });

  it('treats null like/comment/share counts as zero', () => {
    expect(
      computeEngagementScore({
        viewCount: 1000,
        likeCount: null,
        commentCount: null,
        shareCount: null,
      }),
    ).toBe(0);
  });

  it('weights comments 3x and shares 5x relative to likes', () => {
    const score = computeEngagementScore({
      viewCount: 100,
      likeCount: 10,
      commentCount: 2,
      shareCount: 1,
    });
    // (10 + 2*3 + 1*5) / 100 = 21 / 100
    expect(score).toBeCloseTo(0.21);
  });
});
