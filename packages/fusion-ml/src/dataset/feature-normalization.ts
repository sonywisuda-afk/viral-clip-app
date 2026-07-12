import type { FeatureVector } from '@speedora/contracts';

export interface FeatureStats {
  min: number;
  max: number;
}

// Min-max normalization per feature index, using externally-computed
// per-feature stats (so the same stats - fit on a training set - can be
// reapplied to validation/inference data without recomputing them from
// data the model shouldn't see). A feature with min === max normalizes to
// 0.5 (no signal either way), not NaN or a divide-by-zero.
export function normalizeFeatureVector(vector: FeatureVector, stats: FeatureStats[]): FeatureVector {
  if (stats.length !== vector.values.length) {
    throw new Error(
      `stats length (${stats.length}) must match FeatureVector.values length (${vector.values.length})`,
    );
  }
  const values = vector.values.map((value, i) => {
    const { min, max } = stats[i];
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  });
  return { ...vector, values };
}

// Fits per-feature min/max stats from a set of FeatureVectors - the
// "compute on train, apply to train+validation" half of the pattern above.
export function computeFeatureStats(vectors: FeatureVector[]): FeatureStats[] {
  if (vectors.length === 0) return [];
  const dimensions = vectors[0].values.length;
  const stats: FeatureStats[] = [];
  for (let i = 0; i < dimensions; i++) {
    const column = vectors.map((v) => v.values[i]);
    stats.push({ min: Math.min(...column), max: Math.max(...column) });
  }
  return stats;
}
