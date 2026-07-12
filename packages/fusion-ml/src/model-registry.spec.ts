import type { ModelMetadata } from '@speedora/contracts';
import { computeChecksum, InMemoryModelRegistry } from './model-registry';
import { serializeModel } from './model-serialization';

function fixtureMetadata(overrides: Partial<ModelMetadata> = {}): ModelMetadata {
  return {
    modelId: 'baseline',
    modelVersion: 'v3.0.0',
    createdAt: '2026-07-12T00:00:00.000Z',
    datasetVersion: 'ds-1',
    featureVersion: 'fv-1',
    trainingSampleCount: 100,
    evaluationScore: 0.5,
    checksum: 'deadbeef',
    ...overrides,
  };
}

describe('computeChecksum', () => {
  it('is deterministic for the same input', () => {
    expect(computeChecksum('hello')).toBe(computeChecksum('hello'));
  });

  it('differs for different input', () => {
    expect(computeChecksum('hello')).not.toBe(computeChecksum('world'));
  });

  it('produces a 64-char hex sha256 digest', () => {
    expect(computeChecksum('hello')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches a known sha256 value', () => {
    // sha256('hello') is a well-known test vector.
    expect(computeChecksum('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('can checksum a serialized model round-trip', () => {
    const model = { type: 'mock-baseline', params: { average: 0.42 } };
    const checksum = computeChecksum(serializeModel(model));
    expect(checksum).toBe(computeChecksum(serializeModel(model)));
  });
});

describe('InMemoryModelRegistry', () => {
  it('returns null for get/getLatest when nothing is registered', async () => {
    const registry = new InMemoryModelRegistry();
    expect(await registry.get('v1')).toBeNull();
    expect(await registry.getLatest()).toBeNull();
    expect(await registry.list()).toEqual([]);
  });

  it('registers and retrieves a model by version', async () => {
    const registry = new InMemoryModelRegistry();
    const metadata = fixtureMetadata();
    await registry.register({ weights: [1, 2, 3] }, metadata);

    const entry = await registry.get('v3.0.0');
    expect(entry).toEqual({ model: { weights: [1, 2, 3] }, metadata });
  });

  it('getLatest returns the most recently registered version, not the highest version string', async () => {
    const registry = new InMemoryModelRegistry();
    await registry.register({ n: 1 }, fixtureMetadata({ modelVersion: 'v3.2.0' }));
    await registry.register({ n: 2 }, fixtureMetadata({ modelVersion: 'v3.1.0' }));

    const latest = await registry.getLatest();
    expect(latest?.metadata.modelVersion).toBe('v3.1.0');
  });

  it('list returns metadata for every registered version', async () => {
    const registry = new InMemoryModelRegistry();
    await registry.register({}, fixtureMetadata({ modelVersion: 'v1' }));
    await registry.register({}, fixtureMetadata({ modelVersion: 'v2' }));

    const versions = (await registry.list()).map((m) => m.modelVersion).sort();
    expect(versions).toEqual(['v1', 'v2']);
  });
});
