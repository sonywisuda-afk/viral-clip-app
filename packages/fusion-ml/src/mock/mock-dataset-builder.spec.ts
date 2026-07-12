import type { FeatureExtractor } from '../interfaces';
import { MockDatasetBuilder } from './mock-dataset-builder';

describe('MockDatasetBuilder', () => {
  it('builds one TrainingSample per sample id, using the injected extractor', async () => {
    const fakeExtractor: FeatureExtractor = {
      extract: async (clipId: string) => ({
        clipId,
        featureNames: ['audio'],
        values: [0.8],
        extractedAt: '2026-01-01T00:00:00.000Z',
      }),
    };
    const builder = new MockDatasetBuilder(fakeExtractor);

    const samples = await builder.build(['a', 'b']);

    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({
      sampleId: 'sample-a',
      featureVector: { clipId: 'a', featureNames: ['audio'], values: [0.8], extractedAt: '2026-01-01T00:00:00.000Z' },
      label: 0.8,
    });
  });

  it('defaults to MockFeatureExtractor when no extractor is injected', async () => {
    const builder = new MockDatasetBuilder();
    const samples = await builder.build(['clip-x']);
    expect(samples).toHaveLength(1);
    expect(samples[0].featureVector.clipId).toBe('clip-x');
  });

  it('returns an empty array for an empty id list', async () => {
    const builder = new MockDatasetBuilder();
    expect(await builder.build([])).toEqual([]);
  });
});
