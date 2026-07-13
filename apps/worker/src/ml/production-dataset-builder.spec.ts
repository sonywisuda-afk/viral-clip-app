import type { DatasetRecord } from '../scripts/dataset-lib';
import { ProductionDatasetBuilder, recordToTrainingSample } from './production-dataset-builder';

describe('recordToTrainingSample', () => {
  it('renames v2 signal prefixes to v3 names and sorts alphabetically', () => {
    const record: DatasetRecord = {
      clipId: 'clip-1',
      'facial.dominantEmotionWeight': 0.6,
      'audio.averageRmsDb': 0.4,
      'scene.cutsPerMinute': 0.8,
      engagementScore: 0.21,
    };

    const sample = recordToTrainingSample(record);

    expect(sample).not.toBeNull();
    expect(sample!.featureVector.clipId).toBe('clip-1');
    expect(sample!.featureVector.featureNames).toEqual([
      'audio.averageRmsDb',
      'emotion.dominantEmotionWeight',
      'scene.cutsPerMinute',
    ]);
    expect(sample!.featureVector.values).toEqual([0.4, 0.6, 0.8]);
    expect(sample!.label).toBe(0.21);
    expect(sample!.sampleId).toBe('sample-clip-1');
  });

  it('drops keys whose signal is not in FUSION_V2_TO_V3_SIGNAL_MAP', () => {
    const record: DatasetRecord = {
      clipId: 'clip-1',
      'llm.engagement.hookStrength': 0.9, // llm is not a v3 signal
      'audio.averageRmsDb': 0.4,
      engagementScore: 0.1,
    };

    const sample = recordToTrainingSample(record);

    expect(sample!.featureVector.featureNames).toEqual(['audio.averageRmsDb']);
  });

  it('returns null when engagementScore is not a number', () => {
    const record: DatasetRecord = {
      clipId: 'clip-1',
      'audio.averageRmsDb': 0.4,
      engagementScore: null,
    };
    expect(recordToTrainingSample(record)).toBeNull();
  });

  it('returns an empty feature vector when nothing matches, not null', () => {
    const record: DatasetRecord = {
      clipId: 'clip-1',
      'llm.engagement.hookStrength': 0.9,
      engagementScore: 0.1,
    };
    const sample = recordToTrainingSample(record);
    expect(sample).not.toBeNull();
    expect(sample!.featureVector.featureNames).toEqual([]);
    expect(sample!.featureVector.values).toEqual([]);
  });
});

// No need to mock '../scripts/dataset-lib' - ProductionDatasetBuilder calls
// the REAL loadUsableSamples(), which only ever touches
// `prisma.clip.findMany`. Faking that one call is enough to drive it
// end-to-end without a real database, same adapter-test convention
// sync-publish-stats.worker.spec.ts already uses.
const findManyMock = jest.fn();

function fakePrisma(clips: unknown[]) {
  return { clip: { findMany: findManyMock.mockResolvedValue(clips) } } as never;
}

describe('ProductionDatasetBuilder', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('listAvailableSampleIds returns clip ids with a non-null engagementScore', async () => {
    const prisma = fakePrisma([
      {
        id: 'clip-1',
        viralityScore: null,
        highlightScore: null,
        highlightConfidence: null,
        highlightBreakdown: [{ signal: 'audio', feature: 'averageRmsDb', normalizedValue: 0.5 }],
        publishRecords: [
          {
            statsSnapshots: [
              {
                capturedAt: new Date('2026-01-01'),
                viewCount: 100,
                likeCount: 1,
                commentCount: 1,
                shareCount: 0,
                watchTimeSeconds: null,
                engagementScore: 0.3,
              },
            ],
          },
        ],
      },
      {
        id: 'clip-2',
        viralityScore: null,
        highlightScore: null,
        highlightConfidence: null,
        highlightBreakdown: [],
        publishRecords: [
          {
            statsSnapshots: [
              {
                capturedAt: new Date('2026-01-01'),
                viewCount: 0,
                likeCount: null,
                commentCount: null,
                shareCount: null,
                watchTimeSeconds: null,
                engagementScore: null,
              },
            ],
          },
        ],
      },
    ]);

    const builder = new ProductionDatasetBuilder(prisma);
    const ids = await builder.listAvailableSampleIds();

    expect(ids).toEqual(['clip-1']);
  });

  it('build reshapes only the requested, matching clips into TrainingSamples', async () => {
    const prisma = fakePrisma([
      {
        id: 'clip-1',
        viralityScore: null,
        highlightScore: null,
        highlightConfidence: null,
        highlightBreakdown: [{ signal: 'audio', feature: 'averageRmsDb', normalizedValue: 0.5 }],
        publishRecords: [
          {
            statsSnapshots: [
              {
                capturedAt: new Date('2026-01-01'),
                viewCount: 100,
                likeCount: 1,
                commentCount: 1,
                shareCount: 0,
                watchTimeSeconds: null,
                engagementScore: 0.3,
              },
            ],
          },
        ],
      },
    ]);

    const builder = new ProductionDatasetBuilder(prisma);
    const samples = await builder.build(['clip-1', 'clip-nonexistent']);

    expect(samples).toHaveLength(1);
    expect(samples[0].featureVector.clipId).toBe('clip-1');
    expect(samples[0].featureVector.featureNames).toEqual(['audio.averageRmsDb']);
    expect(samples[0].label).toBe(0.3);
  });
});
