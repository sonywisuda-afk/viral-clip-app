import type { ClipMetadataInput } from '@speedora/contracts';
import { buildClipMetadataReport } from './build-clip-metadata-report';

function baseInput(overrides: Partial<ClipMetadataInput> = {}): ClipMetadataInput {
  return {
    clips: [
      {
        id: 'clip-1',
        startTime: 0,
        endTime: 30,
        hookText: 'You will not believe this',
        hashtags: ['productivity'],
        keywords: ['focus'],
        topics: ['self-improvement'],
        intent: 'educate',
        ctaText: 'Subscribe for more',
        highlightScore: 72,
        highlightRank: 1,
        scores: { hookStrength: 80, ctaStrength: 65 },
      },
    ],
    ...overrides,
  };
}

describe('buildClipMetadataReport', () => {
  it('selects every metadata field per clip, renaming id to clipId', () => {
    const result = buildClipMetadataReport(baseInput());
    expect(result.clips).toEqual([
      {
        clipId: 'clip-1',
        startTime: 0,
        endTime: 30,
        hookText: 'You will not believe this',
        hashtags: ['productivity'],
        keywords: ['focus'],
        topics: ['self-improvement'],
        intent: 'educate',
        ctaText: 'Subscribe for more',
        highlightScore: 72,
        highlightRank: 1,
        scores: { hookStrength: 80, ctaStrength: 65 },
      },
    ]);
  });

  it('returns an empty list for a video with no clips', () => {
    expect(buildClipMetadataReport(baseInput({ clips: [] })).clips).toEqual([]);
  });

  it('passes nulls through for a clip missing optional fields', () => {
    const result = buildClipMetadataReport(
      baseInput({
        clips: [
          {
            id: 'clip-2',
            startTime: 0,
            endTime: 10,
            hookText: null,
            hashtags: [],
            keywords: [],
            topics: [],
            intent: null,
            ctaText: null,
            highlightScore: null,
            highlightRank: null,
            scores: null,
          },
        ],
      }),
    );
    expect(result.clips[0]).toEqual({
      clipId: 'clip-2',
      startTime: 0,
      endTime: 10,
      hookText: null,
      hashtags: [],
      keywords: [],
      topics: [],
      intent: null,
      ctaText: null,
      highlightScore: null,
      highlightRank: null,
      scores: null,
    });
  });
});
