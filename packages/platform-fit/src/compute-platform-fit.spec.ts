import type { ClipScores } from '@speedora/contracts';
import { SOCIAL_PLATFORMS } from '@speedora/contracts';
import { computePlatformFit } from './compute-platform-fit';
import { DEFAULT_PLATFORM_FIT_WEIGHTS } from './weights';

function zeroScores(overrides: Partial<ClipScores> = {}): ClipScores {
  return {
    hookStrength: 0,
    educationalValue: 0,
    practicalValue: 0,
    curiosity: 0,
    emotion: 0,
    storytelling: 0,
    novelty: 0,
    trustAuthority: 0,
    ctaStrength: 0,
    ...overrides,
  };
}

describe('DEFAULT_PLATFORM_FIT_WEIGHTS', () => {
  it('covers every SocialPlatform', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(DEFAULT_PLATFORM_FIT_WEIGHTS[platform]).toBeDefined();
    }
  });

  it('sums to 1 for every platform', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const weights = DEFAULT_PLATFORM_FIT_WEIGHTS[platform];
      const sum = Object.values(weights).reduce((total, w) => total + (w ?? 0), 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe('computePlatformFit', () => {
  it('ranks all 8 platforms, sorted descending by score', () => {
    const result = computePlatformFit(zeroScores({ hookStrength: 100 }));
    expect(result.rankings).toHaveLength(SOCIAL_PLATFORMS.length);
    for (let i = 1; i < result.rankings.length; i++) {
      expect(result.rankings[i - 1].score).toBeGreaterThanOrEqual(result.rankings[i].score);
    }
  });

  it('scores 0 for every platform when all ClipScores dims are 0', () => {
    const result = computePlatformFit(zeroScores());
    for (const entry of result.rankings) {
      expect(entry.score).toBe(0);
      // topDimensions still lists weighted dims (all tied at 0 contribution
      // here) - it reflects "which dims this platform's weight vector
      // cares about," not "which dims scored above 0."
      expect(entry.topDimensions.length).toBeGreaterThan(0);
      expect(entry.topDimensions.length).toBeLessThanOrEqual(3);
    }
  });

  it('scores 100 for every platform when every dim is maxed (weights sum to 1)', () => {
    const result = computePlatformFit(
      zeroScores({
        hookStrength: 100,
        educationalValue: 100,
        practicalValue: 100,
        curiosity: 100,
        emotion: 100,
        storytelling: 100,
        novelty: 100,
        trustAuthority: 100,
        ctaStrength: 100,
      }),
    );
    for (const entry of result.rankings) {
      expect(entry.score).toBeCloseTo(100, 5);
    }
  });

  it('ranks TikTok/Threads above LinkedIn/YouTube for a hook-and-curiosity-heavy clip', () => {
    const result = computePlatformFit(zeroScores({ hookStrength: 90, curiosity: 90 }));
    const rank = (platform: string) => result.rankings.findIndex((r) => r.platform === platform);
    expect(rank('TIKTOK')).toBeLessThan(rank('LINKEDIN'));
    expect(rank('TIKTOK')).toBeLessThan(rank('YOUTUBE'));
    expect(rank('THREADS')).toBeLessThan(rank('LINKEDIN'));
  });

  it('ranks LinkedIn/YouTube above TikTok/Threads for an educational, authoritative clip', () => {
    const result = computePlatformFit(
      zeroScores({ educationalValue: 90, trustAuthority: 90, practicalValue: 90 }),
    );
    const rank = (platform: string) => result.rankings.findIndex((r) => r.platform === platform);
    expect(rank('LINKEDIN')).toBeLessThan(rank('TIKTOK'));
    expect(rank('YOUTUBE')).toBeLessThan(rank('TIKTOK'));
  });

  it('reports topDimensions sorted by contribution, capped at 3, only weighted dims', () => {
    const result = computePlatformFit(
      zeroScores({ hookStrength: 100, curiosity: 50, emotion: 10 }),
    );
    const tiktok = result.rankings.find((r) => r.platform === 'TIKTOK')!;
    expect(tiktok.topDimensions[0]).toBe('hookStrength');
    expect(tiktok.topDimensions.length).toBeLessThanOrEqual(3);
    expect(tiktok.topDimensions).not.toContain('educationalValue');
  });

  it('clamps score into [0, 100] even with a custom out-of-range weight vector', () => {
    const result = computePlatformFit(zeroScores({ hookStrength: 100 }), {
      TIKTOK: { hookStrength: 5 },
      INSTAGRAM: {},
      FACEBOOK: {},
      THREADS: {},
      YOUTUBE: {},
      LINKEDIN: {},
      PINTEREST: {},
      X: {},
    });
    const tiktok = result.rankings.find((r) => r.platform === 'TIKTOK')!;
    expect(tiktok.score).toBe(100);
  });

  it('falls back to an empty weight object (score 0) for a platform missing from a custom vector', () => {
    const result = computePlatformFit(zeroScores({ hookStrength: 100 }), {
      TIKTOK: { hookStrength: 1 },
    } as never);
    const instagram = result.rankings.find((r) => r.platform === 'INSTAGRAM')!;
    expect(instagram.score).toBe(0);
    expect(instagram.topDimensions).toEqual([]);
  });
});
