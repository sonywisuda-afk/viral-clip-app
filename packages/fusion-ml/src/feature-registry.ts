import type { FeatureSchema } from '@speedora/contracts';
import { computeChecksum } from './model-registry';
import { serializeModel } from './model-serialization';

// Milestone 2B - same determinism property as computeDatasetVersion: the
// same feature-name list always produces the same version, any change to
// the list (a new named feature appearing, one disappearing, or a reorder)
// produces a different one. Order-sensitive on purpose, unlike
// computeDatasetVersion - featureNames' ORDER is itself meaningful (it's
// what FeatureVector.values is positionally aligned to), so two lists with
// the same names in a different order really are a different schema.
export function computeFeatureVersion(featureNames: string[]): string {
  return computeChecksum(serializeModel(featureNames)).slice(0, 12);
}

// A versioned collection of FeatureSchemas, keyed by featureVersion - same
// shape as ModelRegistry (register/get/list/getLatest), so the two
// registries are consistent to work with side by side in pipeline.ts.
export interface FeatureRegistry {
  register(schema: FeatureSchema): Promise<void>;
  get(featureVersion: string): Promise<FeatureSchema | null>;
  list(): Promise<FeatureSchema[]>;
  getLatest(): Promise<FeatureSchema | null>;
}

// The one concrete implementation this milestone ships - a Map, same
// "no real storage backing yet" posture as InMemoryModelRegistry
// (model-registry.ts) and for the same reason: nothing durable to persist
// across runs yet.
export class InMemoryFeatureRegistry implements FeatureRegistry {
  private readonly entries = new Map<string, FeatureSchema>();
  private latestVersion: string | null = null;

  async register(schema: FeatureSchema): Promise<void> {
    this.entries.set(schema.featureVersion, schema);
    this.latestVersion = schema.featureVersion;
  }

  async get(featureVersion: string): Promise<FeatureSchema | null> {
    return this.entries.get(featureVersion) ?? null;
  }

  async list(): Promise<FeatureSchema[]> {
    return [...this.entries.values()];
  }

  async getLatest(): Promise<FeatureSchema | null> {
    if (this.latestVersion === null) return null;
    return this.entries.get(this.latestVersion) ?? null;
  }
}
