import type { OcrSample } from '@speedora/contracts';
import { trackOcrText, type FaceBoundingBoxSample } from './track-ocr-text';

function sample(
  t: number,
  blocks: {
    text: string;
    box?: Partial<OcrSample['textBlocks'][number]['boundingBox']>;
    confidence?: number;
  }[],
): OcrSample {
  return {
    t,
    textBlocks: blocks.map(({ text, box, confidence }) => ({
      text,
      boundingBox: { xCenter: 0.5, yCenter: 0.85, width: 0.4, height: 0.05, ...box },
      confidence: confidence ?? 0.9,
    })),
  };
}

describe('trackOcrText', () => {
  it('groups the same text at the same position across consecutive samples into one track', () => {
    const tracks = trackOcrText([
      sample(0, [{ text: 'hello world' }]),
      sample(1, [{ text: 'hello world' }]),
      sample(2, [{ text: 'hello world' }]),
    ]);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      text: 'hello world',
      appearsFrames: 3,
      startTime: 0,
      endTime: 2,
    });
  });

  it('starts a new track when the text changes substantially, even at the same position', () => {
    const tracks = trackOcrText([
      sample(0, [{ text: 'abcde' }]),
      sample(1, [{ text: '12345' }]), // zero characters in common with 'abcde'
    ]);
    expect(tracks).toHaveLength(2);
  });

  it('tolerates a single missed sample and continues the same track when the text reappears', () => {
    const tracks = trackOcrText([
      sample(0, [{ text: 'ACME logo' }]),
      sample(1, []), // missed - occlusion
      sample(2, [{ text: 'ACME logo' }]),
    ]);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].appearsFrames).toBe(2);
    expect(tracks[0].startTime).toBe(0);
    expect(tracks[0].endTime).toBe(2);
  });

  it('ends a track (and starts a new one) when missed for more than the tolerance', () => {
    const tracks = trackOcrText([
      sample(0, [{ text: 'ACME logo' }]),
      sample(1, []),
      sample(2, []),
      sample(3, [{ text: 'ACME logo' }]),
    ]);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].appearsFrames).toBe(1);
    expect(tracks[1].appearsFrames).toBe(1);
  });

  it('tracks multiple simultaneous text blocks per frame as separate tracks', () => {
    const tracks = trackOcrText([
      sample(0, [
        { text: 'subtitle line one', box: { yCenter: 0.9 } },
        { text: 'ACME', box: { xCenter: 0.9, yCenter: 0.05, width: 0.1, height: 0.04 } },
      ]),
      sample(1, [
        { text: 'subtitle line one', box: { yCenter: 0.9 } },
        { text: 'ACME', box: { xCenter: 0.9, yCenter: 0.05, width: 0.1, height: 0.04 } },
      ]),
    ]);
    expect(tracks).toHaveLength(2);
    expect(tracks.map((t) => t.text).sort()).toEqual(['ACME', 'subtitle line one']);
    expect(tracks.every((t) => t.appearsFrames === 2)).toBe(true);
  });

  it('computes persistenceScore as appearsFrames divided by the TOTAL sample count, not the track span', () => {
    const tracks = trackOcrText([
      sample(0, []),
      sample(1, [{ text: 'hello' }]),
      sample(2, [{ text: 'hello' }]),
      sample(3, []),
    ]);
    expect(tracks[0].persistenceScore).toBeCloseTo(0.5);
  });

  it('leaves motionScore null for a track that only appeared once', () => {
    const tracks = trackOcrText([sample(0, [{ text: 'hello' }])]);
    expect(tracks[0].motionScore).toBeNull();
  });

  it('gives motionScore 0 for a perfectly static track', () => {
    const tracks = trackOcrText([sample(0, [{ text: 'hello' }]), sample(1, [{ text: 'hello' }])]);
    expect(tracks[0].motionScore).toBe(0);
  });

  it('gives a higher motionScore for a track whose position moves a lot between samples', () => {
    const tracks = trackOcrText([
      sample(0, [{ text: 'rolling credits', box: { xCenter: 0.5, yCenter: 0.9 } }]),
      sample(1, [{ text: 'rolling credits', box: { xCenter: 0.5, yCenter: 0.1 } }]),
    ]);
    expect(tracks[0].motionScore).toBe(1); // clamped at the cap
  });

  it('leaves nearFace null when no face bounding-box data is supplied at all', () => {
    const tracks = trackOcrText([sample(0, [{ text: 'John Smith' }])]);
    expect(tracks[0].nearFace).toBeNull();
  });

  it('resolves nearFace true when the text block is close to a face at a matching timestamp', () => {
    const faceBoundingBoxes: FaceBoundingBoxSample[] = [
      { t: 0, boundingBox: { xCenter: 0.5, yCenter: 0.6, width: 0.3, height: 0.4 } },
    ];
    const tracks = trackOcrText(
      [
        sample(0, [
          { text: 'John Smith', box: { xCenter: 0.5, yCenter: 0.75, width: 0.2, height: 0.05 } },
        ]),
      ],
      faceBoundingBoxes,
    );
    expect(tracks[0].nearFace).toBe(true);
  });

  it('resolves nearFace false when the nearest face is too far away', () => {
    const faceBoundingBoxes: FaceBoundingBoxSample[] = [
      { t: 0, boundingBox: { xCenter: 0.1, yCenter: 0.1, width: 0.2, height: 0.2 } },
    ];
    const tracks = trackOcrText(
      [sample(0, [{ text: 'John Smith', box: { xCenter: 0.9, yCenter: 0.9 } }])],
      faceBoundingBoxes,
    );
    expect(tracks[0].nearFace).toBe(false);
  });

  it('flags isPriceLike for a currency-shaped text and isNameLike for a Title-Case short string', () => {
    const tracks = trackOcrText([
      sample(0, [{ text: '$19.99' }, { text: 'John Smith', box: { xCenter: 0.9 } }]),
    ]);
    const price = tracks.find((t) => t.text === '$19.99')!;
    const name = tracks.find((t) => t.text === 'John Smith')!;
    expect(price.regexFlags).toEqual({ isPriceLike: true, isNameLike: false });
    expect(name.regexFlags).toEqual({ isPriceLike: false, isNameLike: true });
  });

  it('always leaves language null', () => {
    const tracks = trackOcrText([sample(0, [{ text: 'hello' }])]);
    expect(tracks[0].language).toBeNull();
  });

  it('returns an empty array when no samples ever had any text', () => {
    const tracks = trackOcrText([sample(0, []), sample(1, [])]);
    expect(tracks).toEqual([]);
  });
});
