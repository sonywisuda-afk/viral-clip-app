import { OCR_TEXT_CATEGORIES, type OcrTextCategory, type OcrTextTrack } from '@speedora/contracts';
import type { OcrTrackedFeatures } from './track-ocr-text';

// AI Fusion roadmap's OCR initiative, Batch OCR-2 - "Rule Fusion" stage:
// scores EVERY one of the 6 categories (not just testing them in priority
// order until one hits) from a track's already-extracted features, then
// picks the argmax as `category` with its own score as
// `categoryConfidence` - user's own spec: "Rule-based fusion yang
// menghasilkan probabilitas untuk keenam kategori" (rule-based fusion
// producing a probability for all six categories). Each per-category
// score is a plain average of a few 0-1 sub-scores - deterministic
// weighted rules, explicitly named "HybridRuleEngine" (not a trained
// model) - every threshold below is a reasonable guess, not calibrated
// against real footage, same "kejujuran skala" as every other heuristic
// in this pipeline.

const SUBTITLE_Y_THRESHOLD = 0.7;
const SUBTITLE_MIN_WIDTH = 0.3;
const LOGO_MAX_AREA = 0.05;
// How close (Euclidean distance from box center to nearest frame corner)
// counts as "in a corner" for logo scoring - 0 at the corner itself, no
// credit at/beyond this distance.
const LOGO_CORNER_MAX_DISTANCE = 0.35;
const SLIDE_MIN_AREA = 0.25;
// A fallback baseline score for "caption" - deliberately not 0, since an
// on-screen text overlay that matches none of the other 5 categories'
// criteria is still MOST LIKELY a generic caption/overlay, not nothing.
// Any other category scoring above this wins outright.
const CAPTION_BASELINE_SCORE = 0.3;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const FRAME_CORNERS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

function cornerProximityScore(track: OcrTrackedFeatures): number {
  const distances = FRAME_CORNERS.map((corner) =>
    Math.hypot(track.boundingBox.xCenter - corner.x, track.boundingBox.yCenter - corner.y),
  );
  const closest = Math.min(...distances);
  return clamp01(1 - closest / LOGO_CORNER_MAX_DISTANCE);
}

// Subtitles sit low AND wide - position and width are both REQUIRED
// (multiplicative gates, not averaged), since a wide-but-mid-frame block
// or a narrow-but-low block is much less subtitle-shaped than either
// property alone might suggest. Stillness is a secondary modifier (up to
// 2x), not an independent vote - a moving element loses credit, but a
// perfectly still one doesn't get a "free" boost strong enough to win
// on its own.
function scoreSubtitle(track: OcrTrackedFeatures): number {
  const positionScore = clamp01(track.boundingBox.yCenter / SUBTITLE_Y_THRESHOLD);
  const widthScore = clamp01(track.boundingBox.width / SUBTITLE_MIN_WIDTH);
  const stillnessModifier =
    0.5 + 0.5 * (track.motionScore === null ? 1 : clamp01(1 - track.motionScore));
  return positionScore * widthScore * stillnessModifier;
}

// A slide/whiteboard/document fills much of the frame - size is the
// primary (and only strictly required) gate; stillness is a secondary
// modifier, same reasoning as scoreSubtitle above.
function scoreSlide(track: OcrTrackedFeatures): number {
  const area = track.boundingBox.width * track.boundingBox.height;
  const areaScore = clamp01(area / SLIDE_MIN_AREA);
  const stillnessModifier =
    0.5 + 0.5 * (track.motionScore === null ? 1 : clamp01(1 - track.motionScore));
  return areaScore * stillnessModifier;
}

// A logo/watermark is small AND tucked in a corner - corner proximity is
// the PRIMARY multiplicative gate (a small block dead-center in the
// frame should score near 0 here, not get partial credit just for being
// small), with area/persistence as supporting evidence once near a
// corner.
function scoreLogo(track: OcrTrackedFeatures): number {
  const area = track.boundingBox.width * track.boundingBox.height;
  const areaScore = clamp01(LOGO_MAX_AREA / Math.max(area, 1e-6));
  return cornerProximityScore(track) * average([Math.min(1, areaScore), track.persistenceScore]);
}

// A price mention is almost entirely a content signal, not a position
// one - it can legitimately appear anywhere on screen.
function scorePrice(track: OcrTrackedFeatures): number {
  return track.regexFlags.isPriceLike ? 1 : 0;
}

// A name tag/lower-third needs BOTH a name-shaped string AND proximity to
// a face - either alone isn't enough (a name-shaped string with no face
// data at all gets partial, capped credit rather than a confident "yes").
function scoreName(track: OcrTrackedFeatures): number {
  if (!track.regexFlags.isNameLike) return 0;
  if (track.nearFace === null) return 0.5;
  return track.nearFace ? 1 : 0.2;
}

function scoreCaption(): number {
  return CAPTION_BASELINE_SCORE;
}

const SCORERS: Record<OcrTextCategory, (track: OcrTrackedFeatures) => number> = {
  subtitle: scoreSubtitle,
  slide: scoreSlide,
  caption: scoreCaption,
  logo: scoreLogo,
  price: scorePrice,
  name: scoreName,
};

// Pure, synchronous - scores every category, picks the argmax (ties
// broken by OCR_TEXT_CATEGORIES' own declared order, 'caption' listed
// early as a deliberately-favored fallback), and reports that winning
// score as categoryConfidence. classificationMethod is always
// "HybridRuleEngine" in this batch - see ocrTextTrackSchema's own comment
// for why that's a literal field, not just documentation.
export function classifyOcrTrack(track: OcrTrackedFeatures): OcrTextTrack {
  let bestCategory: OcrTextCategory = OCR_TEXT_CATEGORIES[0];
  let bestScore = -Infinity;
  for (const category of OCR_TEXT_CATEGORIES) {
    const score = clamp01(SCORERS[category](track));
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return {
    ...track,
    category: bestCategory,
    categoryConfidence: bestScore,
    classificationMethod: 'HybridRuleEngine',
  };
}
