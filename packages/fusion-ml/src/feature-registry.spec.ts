import type { FeatureSchema } from '@speedora/contracts';
import { computeFeatureVersion, InMemoryFeatureRegistry } from './feature-registry';

describe('computeFeatureVersion', () => {
  it('is deterministic for the same feature name list', () => {
    expect(computeFeatureVersion(['audio.a', 'scene.b'])).toBe(
      computeFeatureVersion(['audio.a', 'scene.b']),
    );
  });

  it('is order-sensitive, unlike computeDatasetVersion', () => {
    expect(computeFeatureVersion(['audio.a', 'scene.b'])).not.toBe(
      computeFeatureVersion(['scene.b', 'audio.a']),
    );
  });

  it('differs when a feature name changes', () => {
    expect(computeFeatureVersion(['audio.a'])).not.toBe(computeFeatureVersion(['audio.b']));
  });
});

function fixtureSchema(overrides: Partial<FeatureSchema> = {}): FeatureSchema {
  return {
    featureVersion: 'fv-1',
    featureNames: ['audio.a', 'scene.b'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryFeatureRegistry', () => {
  it('returns null/empty when nothing is registered', async () => {
    const registry = new InMemoryFeatureRegistry();
    expect(await registry.get('fv-1')).toBeNull();
    expect(await registry.getLatest()).toBeNull();
    expect(await registry.list()).toEqual([]);
  });

  it('registers and retrieves a schema by featureVersion', async () => {
    const registry = new InMemoryFeatureRegistry();
    const schema = fixtureSchema();
    await registry.register(schema);
    expect(await registry.get('fv-1')).toEqual(schema);
  });

  it('getLatest returns the most recently registered version', async () => {
    const registry = new InMemoryFeatureRegistry();
    await registry.register(fixtureSchema({ featureVersion: 'fv-1' }));
    await registry.register(fixtureSchema({ featureVersion: 'fv-2' }));
    expect((await registry.getLatest())?.featureVersion).toBe('fv-2');
  });

  it('list returns every registered schema', async () => {
    const registry = new InMemoryFeatureRegistry();
    await registry.register(fixtureSchema({ featureVersion: 'fv-1' }));
    await registry.register(fixtureSchema({ featureVersion: 'fv-2' }));
    const versions = (await registry.list()).map((s) => s.featureVersion).sort();
    expect(versions).toEqual(['fv-1', 'fv-2']);
  });
});
