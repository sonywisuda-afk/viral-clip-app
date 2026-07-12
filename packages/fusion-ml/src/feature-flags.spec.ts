import { isFusionV3Enabled } from './feature-flags';

describe('isFusionV3Enabled', () => {
  const original = process.env.FUSION_ENGINE_V3_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.FUSION_ENGINE_V3_ENABLED;
    else process.env.FUSION_ENGINE_V3_ENABLED = original;
  });

  it('is false when the env var is unset', () => {
    delete process.env.FUSION_ENGINE_V3_ENABLED;
    expect(isFusionV3Enabled()).toBe(false);
  });

  it('is false for any value other than the literal string "true"', () => {
    process.env.FUSION_ENGINE_V3_ENABLED = '1';
    expect(isFusionV3Enabled()).toBe(false);
    process.env.FUSION_ENGINE_V3_ENABLED = 'TRUE';
    expect(isFusionV3Enabled()).toBe(false);
  });

  it('is true when explicitly set to "true"', () => {
    process.env.FUSION_ENGINE_V3_ENABLED = 'true';
    expect(isFusionV3Enabled()).toBe(true);
  });
});
