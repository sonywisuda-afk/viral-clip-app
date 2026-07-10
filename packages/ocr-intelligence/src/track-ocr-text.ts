import type { OcrRegexFlags, OcrSample, OcrTextBlock, OcrTextTrack } from '@speedora/contracts';

// AI Fusion roadmap's OCR initiative, Batch OCR-2 - cross-frame text
// tracking, entirely in TypeScript over the already-persisted raw
// ocrText array (no changes to detect_ocr_text.py at all) - unlike Batch
// 4's face tracking (which needs real-time frame-by-frame state DURING
// video decode), all of this clip's OCR samples already exist upfront by
// the time this runs, so there's no reason to duplicate tracking logic
// inside the subprocess.
//
// Deliberately simpler than Batch 4's Kalman+Hungarian tracker: OCR text
// doesn't move with physics the way a face does (a subtitle/logo/slide is
// either static or the whole assumption of "predictable motion" doesn't
// apply), and a frame can have MULTIPLE simultaneous text regions (a
// genuine multi-object association problem, unlike Batch 4's single-face
// case) - so this uses a plain GREEDY lowest-cost-first assignment each
// frame (sorted candidate pairs, first-come-first-served) rather than a
// full Hungarian solver. Good enough for this use case's coarser
// 1-sample/sec rate; not claimed to be optimal.

// Same normalized-[0,1]-bounding-box convention as ocrTextBlockSchema.
type BoundingBox = OcrTextBlock['boundingBox'];

// A face's own bounding box at a point in time - the caller-supplied
// narrow input for the `nearFace` feature (same "narrow input contract"
// pattern as @speedora/facial-intelligence's AudioActivityWindow - this
// package has no dependency on @speedora/facial-intelligence's own
// FaceLandmarkSample shape, the apps/worker adapter maps it down to this).
export interface FaceBoundingBoxSample {
  t: number;
  boundingBox: BoundingBox;
}

// Match-cost weights/thresholds - reasonable guesses, not calibrated
// against real footage, same "kejujuran skala" as every other threshold
// in this pipeline.
const TEXT_SIMILARITY_WEIGHT = 0.6;
const IOU_WEIGHT = 0.4;
// Cost above this means "not the same on-screen element" - start a new
// track rather than continuing an existing one.
const MATCH_COST_THRESHOLD = 0.5;
// Consecutive missed samples a track tolerates before it's considered
// ended (a brief occlusion/misread, not a genuinely different element) -
// same concept as Batch 4's MAX_MISSES, much smaller here since OCR
// samples are coarser (1/sec) and a real gap should usually just end the
// track.
const MAX_MISS_SAMPLES = 1;
// Typical frame-to-frame bounding-box-center movement for a static
// element (logo/slide/subtitle) - at/above this reads as "maximally
// moving" (scrolling credits, etc.).
const MOTION_CAP = 0.1;
// How close (Euclidean distance between box centers) a text block needs
// to be to a face to count as "near" it - a coarse proximity check, NOT a
// true lower-third/overlap geometry test.
const NEAR_FACE_DISTANCE_THRESHOLD = 0.3;
// How far apart in time a face reading can be from an OCR sample and
// still be treated as "at the same moment" for the nearFace check.
const NEAR_FACE_TIME_TOLERANCE_SECONDS = 1.5;

// Content-pattern regexes - deliberately rough/non-exhaustive, a coarse
// proxy for "looks like a price" / "looks like a person's name", not real
// NER. See ocrRegexFlagsSchema's own comment for the honest caveat.
const PRICE_REGEX = /(?:[$€£¥]|rp\.?|idr)\s?\d[\d.,]*\d|\d[\d.,]*\d\s?(?:usd|idr|rp)\b/i;
const NAME_LIKE_REGEX = /^[A-Z][a-z]+(\s[A-Z][a-z]+){0,2}$/;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Classic edit-distance DP, normalized by the longer string's length into
// a 0-1 SIMILARITY (1 = identical) - a plain, dependency-free string
// comparison, not a semantic/NLP one.
function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) distances[i][0] = i;
  for (let j = 0; j < cols; j++) distances[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
    }
  }
  return clamp01(1 - distances[rows - 1][cols - 1] / maxLength);
}

// Same intersection-over-union formula as detect_face_landmarks.py's own
// iou() (Batch 4), reimplemented here in TypeScript rather than shared
// across the language boundary.
function iou(a: BoundingBox, b: BoundingBox): number {
  const ax0 = a.xCenter - a.width / 2;
  const ay0 = a.yCenter - a.height / 2;
  const ax1 = a.xCenter + a.width / 2;
  const ay1 = a.yCenter + a.height / 2;
  const bx0 = b.xCenter - b.width / 2;
  const by0 = b.yCenter - b.height / 2;
  const bx1 = b.xCenter + b.width / 2;
  const by1 = b.yCenter + b.height / 2;

  const ix0 = Math.max(ax0, bx0);
  const iy0 = Math.max(ay0, by0);
  const ix1 = Math.min(ax1, bx1);
  const iy1 = Math.min(ay1, by1);
  const intersection = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
}

function matchCost(a: OcrTextBlock, b: OcrTextBlock): number {
  return (
    TEXT_SIMILARITY_WEIGHT * (1 - textSimilarity(a.text, b.text)) +
    IOU_WEIGHT * (1 - iou(a.boundingBox, b.boundingBox))
  );
}

function computeRegexFlags(text: string): OcrRegexFlags {
  const trimmed = text.trim();
  return {
    isPriceLike: PRICE_REGEX.test(trimmed),
    isNameLike: NAME_LIKE_REGEX.test(trimmed),
  };
}

function nearestFaceAt(
  t: number,
  faceBoundingBoxes: FaceBoundingBoxSample[],
): FaceBoundingBoxSample | null {
  let closest: FaceBoundingBoxSample | null = null;
  let closestDelta = Infinity;
  for (const face of faceBoundingBoxes) {
    const delta = Math.abs(face.t - t);
    if (delta < closestDelta) {
      closestDelta = delta;
      closest = face;
    }
  }
  return closest && closestDelta <= NEAR_FACE_TIME_TOLERANCE_SECONDS ? closest : null;
}

interface Appearance {
  t: number;
  block: OcrTextBlock;
}

interface ActiveTrack {
  trackId: number;
  lastBlock: OcrTextBlock;
  misses: number;
  appearances: Appearance[];
}

// Everything ocrTextTrackSchema needs EXCEPT category/categoryConfidence/
// classificationMethod - those are classify-ocr-text.ts's job (a
// separate, pure "Rule Fusion" step over this fully-featured-but-not-yet-
// classified track).
export type OcrTrackedFeatures = Omit<
  OcrTextTrack,
  'category' | 'categoryConfidence' | 'classificationMethod'
>;

function averageBoundingBox(boxes: BoundingBox[]): BoundingBox {
  return {
    xCenter: average(boxes.map((box) => box.xCenter)),
    yCenter: average(boxes.map((box) => box.yCenter)),
    width: average(boxes.map((box) => box.width)),
    height: average(boxes.map((box) => box.height)),
  };
}

function buildTrackedFeatures(
  track: ActiveTrack,
  totalSamples: number,
  faceBoundingBoxes: FaceBoundingBoxSample[],
): OcrTrackedFeatures {
  const { appearances } = track;
  const startTime = appearances[0].t;
  const endTime = appearances[appearances.length - 1].t;

  let motionScore: number | null = null;
  if (appearances.length >= 2) {
    const deltas: number[] = [];
    for (let i = 1; i < appearances.length; i++) {
      const a = appearances[i - 1].block.boundingBox;
      const b = appearances[i].block.boundingBox;
      deltas.push(Math.hypot(b.xCenter - a.xCenter, b.yCenter - a.yCenter));
    }
    motionScore = clamp01(average(deltas) / MOTION_CAP);
  }

  const nearFace =
    faceBoundingBoxes.length === 0
      ? null
      : appearances.some(({ t, block }) => {
          const face = nearestFaceAt(t, faceBoundingBoxes);
          if (!face) return false;
          const distance = Math.hypot(
            block.boundingBox.xCenter - face.boundingBox.xCenter,
            block.boundingBox.yCenter - face.boundingBox.yCenter,
          );
          return distance <= NEAR_FACE_DISTANCE_THRESHOLD;
        });

  return {
    trackId: track.trackId,
    text: appearances[0].block.text,
    boundingBox: averageBoundingBox(appearances.map((a) => a.block.boundingBox)),
    confidence: average(appearances.map((a) => a.block.confidence)),
    startTime,
    endTime,
    durationSeconds: endTime - startTime,
    appearsFrames: appearances.length,
    persistenceScore: clamp01(appearances.length / totalSamples),
    motionScore,
    nearFace,
    language: null,
    regexFlags: computeRegexFlags(appearances[0].block.text),
  };
}

// Pure, synchronous - groups raw per-frame ocrTextBlockSchema entries
// (from detectOcrText()'s already-collected samples) into per-element
// tracks. faceBoundingBoxes is optional - omit it (or pass []) when no
// face-landmark data is available for this clip; nearFace then resolves
// to null (not false) on every resulting track, same "no data supplied at
// all" vs. "computed and false" distinction used elsewhere in this
// pipeline (e.g. speakerAudioSyncRate).
export function trackOcrText(
  samples: OcrSample[],
  faceBoundingBoxes: FaceBoundingBoxSample[] = [],
): OcrTrackedFeatures[] {
  const active: ActiveTrack[] = [];
  const finished: ActiveTrack[] = [];
  let nextTrackId = 0;

  for (const sample of samples) {
    const blocks = sample.textBlocks;

    const candidates: { trackIndex: number; blockIndex: number; cost: number }[] = [];
    for (let ti = 0; ti < active.length; ti++) {
      for (let bi = 0; bi < blocks.length; bi++) {
        const cost = matchCost(active[ti].lastBlock, blocks[bi]);
        if (cost <= MATCH_COST_THRESHOLD) candidates.push({ trackIndex: ti, blockIndex: bi, cost });
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);

    const assignedTracks = new Set<number>();
    const assignedBlocks = new Set<number>();
    for (const candidate of candidates) {
      if (assignedTracks.has(candidate.trackIndex) || assignedBlocks.has(candidate.blockIndex))
        continue;
      assignedTracks.add(candidate.trackIndex);
      assignedBlocks.add(candidate.blockIndex);
      const track = active[candidate.trackIndex];
      const block = blocks[candidate.blockIndex];
      track.appearances.push({ t: sample.t, block });
      track.lastBlock = block;
      track.misses = 0;
    }

    for (let ti = active.length - 1; ti >= 0; ti--) {
      if (assignedTracks.has(ti)) continue;
      active[ti].misses++;
      if (active[ti].misses > MAX_MISS_SAMPLES) {
        finished.push(active[ti]);
        active.splice(ti, 1);
      }
    }

    for (let bi = 0; bi < blocks.length; bi++) {
      if (assignedBlocks.has(bi)) continue;
      active.push({
        trackId: nextTrackId++,
        lastBlock: blocks[bi],
        misses: 0,
        appearances: [{ t: sample.t, block: blocks[bi] }],
      });
    }
  }
  finished.push(...active);

  return finished.map((track) => buildTrackedFeatures(track, samples.length, faceBoundingBoxes));
}
