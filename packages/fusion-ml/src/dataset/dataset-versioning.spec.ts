import type { TrainingSample } from '@speedora/contracts';
import { computeDatasetVersion } from './dataset-versioning';

function sample(sampleId: string, label: number): TrainingSample {
  return {
    sampleId,
    featureVector: {
      clipId: sampleId,
      featureNames: ['audio'],
      values: [0.5],
      extractedAt: '2026-01-01T00:00:00.000Z',
    },
    label,
  };
}

describe('computeDatasetVersion', () => {
  it('produces the same version regardless of input order', () => {
    const a = [sample('s1', 1), sample('s2', 2), sample('s3', 3)];
    const b = [sample('s3', 3), sample('s1', 1), sample('s2', 2)];

    expect(computeDatasetVersion(a).checksum).toBe(computeDatasetVersion(b).checksum);
  });

  it('produces a different version when a label changes', () => {
    const a = [sample('s1', 1)];
    const b = [sample('s1', 2)];

    expect(computeDatasetVersion(a).checksum).not.toBe(computeDatasetVersion(b).checksum);
  });

  it('produces a different version when a sample is added', () => {
    const a = [sample('s1', 1)];
    const b = [sample('s1', 1), sample('s2', 2)];

    expect(computeDatasetVersion(a).checksum).not.toBe(computeDatasetVersion(b).checksum);
  });

  it('records the correct sampleCount', () => {
    expect(computeDatasetVersion([sample('s1', 1), sample('s2', 2)]).sampleCount).toBe(2);
    expect(computeDatasetVersion([]).sampleCount).toBe(0);
  });

  it('derives versionId from the first 12 chars of the checksum', () => {
    const version = computeDatasetVersion([sample('s1', 1)]);
    expect(version.versionId).toBe(version.checksum.slice(0, 12));
    expect(version.versionId).toHaveLength(12);
  });
});
