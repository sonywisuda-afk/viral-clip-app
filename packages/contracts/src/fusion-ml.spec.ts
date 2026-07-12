import {
  datasetVersionSchema,
  featureSchemaSchema,
  featureVectorSchema,
  FUSION_V2_TO_V3_SIGNAL_MAP,
  FUSION_V3_SIGNALS,
  modelMetadataSchema,
  predictionResultSchema,
  rankingResultSchema,
  trainingSampleSchema,
} from './fusion-ml';

describe('featureVectorSchema', () => {
  it('accepts a well-formed vector', () => {
    const result = featureVectorSchema.safeParse({
      clipId: 'clip-1',
      featureNames: ['audio', 'scene'],
      values: [0.5, 0.8],
      extractedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects featureNames/values of different lengths', () => {
    const result = featureVectorSchema.safeParse({
      clipId: 'clip-1',
      featureNames: ['audio'],
      values: [0.5, 0.8],
      extractedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty vector (0 features)', () => {
    const result = featureVectorSchema.safeParse({
      clipId: 'clip-1',
      featureNames: [],
      values: [],
      extractedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('trainingSampleSchema', () => {
  it('accepts a well-formed sample', () => {
    const result = trainingSampleSchema.safeParse({
      sampleId: 's1',
      featureVector: {
        clipId: 'clip-1',
        featureNames: ['audio'],
        values: [0.5],
        extractedAt: '2026-01-01T00:00:00.000Z',
      },
      label: 0.7,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a sample whose featureVector is invalid', () => {
    const result = trainingSampleSchema.safeParse({
      sampleId: 's1',
      featureVector: { clipId: 'clip-1', featureNames: ['audio', 'scene'], values: [0.5], extractedAt: 'x' },
      label: 0.7,
    });
    expect(result.success).toBe(false);
  });
});

describe('predictionResultSchema', () => {
  it('accepts a null confidence', () => {
    const result = predictionResultSchema.safeParse({
      clipId: 'c1',
      score: 42,
      confidence: null,
      modelVersion: 'v3-mock',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a confidence outside [0, 1]', () => {
    const result = predictionResultSchema.safeParse({
      clipId: 'c1',
      score: 42,
      confidence: 1.5,
      modelVersion: 'v3-mock',
    });
    expect(result.success).toBe(false);
  });
});

describe('rankingResultSchema', () => {
  it('accepts a well-formed batch', () => {
    const result = rankingResultSchema.safeParse({
      modelVersion: 'v3-mock',
      rankings: [
        { clipId: 'a', rank: 1, score: 90 },
        { clipId: 'b', rank: 2, score: 80 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive rank', () => {
    const result = rankingResultSchema.safeParse({
      modelVersion: 'v3-mock',
      rankings: [{ clipId: 'a', rank: 0, score: 90 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('modelMetadataSchema', () => {
  it('accepts the full given field list', () => {
    const result = modelMetadataSchema.safeParse({
      modelId: 'baseline',
      modelVersion: 'v3.0.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      datasetVersion: 'ds-1',
      featureVersion: 'fv-1',
      trainingSampleCount: 100,
      evaluationScore: 0.5,
      checksum: 'deadbeef',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null evaluationScore', () => {
    const result = modelMetadataSchema.safeParse({
      modelId: 'baseline',
      modelVersion: 'v3.0.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      datasetVersion: 'ds-1',
      featureVersion: 'fv-1',
      trainingSampleCount: 0,
      evaluationScore: null,
      checksum: 'deadbeef',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative trainingSampleCount', () => {
    const result = modelMetadataSchema.safeParse({
      modelId: 'baseline',
      modelVersion: 'v3.0.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      datasetVersion: 'ds-1',
      featureVersion: 'fv-1',
      trainingSampleCount: -1,
      evaluationScore: null,
      checksum: 'deadbeef',
    });
    expect(result.success).toBe(false);
  });
});

describe('datasetVersionSchema', () => {
  it('accepts a well-formed version', () => {
    const result = datasetVersionSchema.safeParse({
      versionId: 'ds-abc123',
      createdAt: '2026-01-01T00:00:00.000Z',
      sampleCount: 42,
      checksum: 'deadbeef',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative sampleCount', () => {
    const result = datasetVersionSchema.safeParse({
      versionId: 'ds-abc123',
      createdAt: '2026-01-01T00:00:00.000Z',
      sampleCount: -1,
      checksum: 'deadbeef',
    });
    expect(result.success).toBe(false);
  });
});

describe('featureSchemaSchema', () => {
  it('accepts a well-formed feature schema', () => {
    const result = featureSchemaSchema.safeParse({
      featureVersion: 'fv-abc123',
      featureNames: ['audio.averageRmsDb', 'emotion.dominantEmotionWeight'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty featureNames array', () => {
    const result = featureSchemaSchema.safeParse({
      featureVersion: 'fv-empty',
      featureNames: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('FUSION_V2_TO_V3_SIGNAL_MAP', () => {
  it('maps every v3 signal from at least one v2 signal key', () => {
    const mappedV3Signals = new Set(Object.values(FUSION_V2_TO_V3_SIGNAL_MAP));
    for (const v3Signal of FUSION_V3_SIGNALS) {
      expect(mappedV3Signals.has(v3Signal)).toBe(true);
    }
  });

  it('renames v2 facial to v3 emotion', () => {
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.facial).toBe('emotion');
  });

  it('maps every other key to itself', () => {
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.audio).toBe('audio');
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.scene).toBe('scene');
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.ocr).toBe('ocr');
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.gesture).toBe('gesture');
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.composition).toBe('composition');
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.speaker).toBe('speaker');
    expect(FUSION_V2_TO_V3_SIGNAL_MAP.cameraMotion).toBe('cameraMotion');
  });
});
