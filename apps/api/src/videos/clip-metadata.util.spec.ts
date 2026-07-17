import type { Clip } from '@speedora/shared';
import { buildClipMetadataReport } from '@speedora/report-builder';
import { buildClipMetadataCsv, toClipMetadataInput } from './clip-metadata.util';

function baseClip(overrides: Partial<Clip> = {}): Clip {
  return {
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
    scores: {
      hookStrength: 80,
      educationalValue: 70,
      practicalValue: 60,
      curiosity: 50,
      emotion: 40,
      storytelling: 30,
      novelty: 20,
      trustAuthority: 10,
      ctaStrength: 65,
    },
    ...overrides,
  } as unknown as Clip;
}

describe('toClipMetadataInput', () => {
  it('narrows every clip field the Clip Metadata format needs', () => {
    const input = toClipMetadataInput([baseClip()]);
    expect(input.clips[0]).toMatchObject({
      id: 'clip-1',
      hookText: 'You will not believe this',
      ctaText: 'Subscribe for more',
      highlightScore: 72,
      highlightRank: 1,
    });
    expect(input.clips[0].scores).toEqual({
      hookStrength: 80,
      educationalValue: 70,
      practicalValue: 60,
      curiosity: 50,
      emotion: 40,
      storytelling: 30,
      novelty: 20,
      trustAuthority: 10,
      ctaStrength: 65,
    });
  });

  it('passes null scores through for a clip with none', () => {
    const input = toClipMetadataInput([baseClip({ scores: null })]);
    expect(input.clips[0].scores).toBeNull();
  });

  it('produces a valid input for buildClipMetadataReport end-to-end', () => {
    const input = toClipMetadataInput([baseClip()]);
    expect(() => buildClipMetadataReport(input)).not.toThrow();
  });
});

describe('buildClipMetadataCsv', () => {
  it('renders one row per clip with a header row', () => {
    const output = buildClipMetadataReport(toClipMetadataInput([baseClip()]));
    const csv = buildClipMetadataCsv(output);
    const lines = csv.trim().split('\n');

    expect(lines[0]).toBe(
      'ClipId,StartTime,EndTime,Hook,Hashtags,Keywords,Topics,Intent,CtaText,HighlightScore,HighlightRank',
    );
    expect(lines[1]).toBe(
      'clip-1,0,30,You will not believe this,productivity,focus,self-improvement,educate,Subscribe for more,72,1',
    );
  });

  it('falls back to "n/a" for a clip missing optional fields', () => {
    const output = buildClipMetadataReport(
      toClipMetadataInput([
        baseClip({
          hookText: null,
          hashtags: [],
          keywords: [],
          topics: [],
          intent: null,
          ctaText: null,
          highlightScore: null,
          highlightRank: null,
        }),
      ]),
    );
    const csv = buildClipMetadataCsv(output);
    expect(csv).toContain('clip-1,0,30,n/a,n/a,n/a,n/a,n/a,n/a,n/a,n/a');
  });
});
