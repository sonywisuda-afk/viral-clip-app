import { createHash } from 'node:crypto';
import type { ModelMetadata } from '@speedora/contracts';

// Real sha256 of the serialized model - lets a ModelRegistry catch a
// corrupted/tampered artifact on load (compare against ModelMetadata.checksum).
// Genuinely exercised by model-registry.spec.ts's round-trip test, not a
// placeholder.
export function computeChecksum(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface RegisteredModel {
  model: unknown;
  metadata: ModelMetadata;
}

// A versioned collection of trained models, keyed by ModelMetadata.modelVersion.
// No real storage backing yet (see docs/ai/fusion-v3.md's "Model versioning"
// section) - packages/storage (S3-compatible) has no prefix-listing API
// today, and no existing "pure computation" package touches it. Once
// Milestone 2B/2C trains something real, a @speedora/storage-backed
// implementation of this interface would store `model` at
// `fusion/v{version}/model.bin` and `metadata` at
// `fusion/v{version}/metadata.json`, matching the `models/fusion/v1/v2/v3/`
// layout - not built now, since there's nothing real to store.
export interface ModelRegistry {
  register(model: unknown, metadata: ModelMetadata): Promise<void>;
  get(modelVersion: string): Promise<RegisteredModel | null>;
  list(): Promise<ModelMetadata[]>;
  getLatest(): Promise<RegisteredModel | null>;
}

// The one concrete implementation this milestone ships - a Map, used by
// tests and by any future dev-mode wiring that doesn't need real
// persistence. `getLatest()` is "most recently registered", not
// "highest version string" - versions aren't assumed to sort lexically or
// numerically (a real registry might use semver, a date, a hash, etc.).
export class InMemoryModelRegistry implements ModelRegistry {
  private readonly entries = new Map<string, RegisteredModel>();
  private latestVersion: string | null = null;

  async register(model: unknown, metadata: ModelMetadata): Promise<void> {
    this.entries.set(metadata.modelVersion, { model, metadata });
    this.latestVersion = metadata.modelVersion;
  }

  async get(modelVersion: string): Promise<RegisteredModel | null> {
    return this.entries.get(modelVersion) ?? null;
  }

  async list(): Promise<ModelMetadata[]> {
    return [...this.entries.values()].map((entry) => entry.metadata);
  }

  async getLatest(): Promise<RegisteredModel | null> {
    if (this.latestVersion === null) return null;
    return this.entries.get(this.latestVersion) ?? null;
  }
}
