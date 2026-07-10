import type { OcrFeatures, OcrTextCategory, OcrTextTrack } from '@speedora/contracts';

// AI Fusion roadmap's OCR initiative, Batch OCR-2 - the dense, Fusion-
// Engine-ready summary derived from classifyOcrTrack()'s already-
// classified tracks, same "raw/features" convention as every other
// intelligence module in this pipeline (raw = ocrText, features = this;
// OcrTextTrack is the extra per-instance layer OCR's own multi-region-
// per-frame shape needs in between, see ocr.ts's own module comment).

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Fraction of ALL sampled frames where a track of this category was
// active - summed across however many distinct tracks of that category
// existed (a clip could have two separate subtitle tracks back to back).
// This slightly over-counts a frame where TWO tracks of the SAME category
// happen to be active simultaneously (rare, e.g. two overlapping caption
// overlays) - a deliberate, documented simplification rather than a
// precise per-sample category-presence walk, since OcrTextTrack itself
// only retains start/end/appearsFrames, not each individual sample
// timestamp it appeared in.
function coverageRateFor(
  tracks: OcrTextTrack[],
  category: OcrTextCategory,
  totalSamples: number,
): number {
  const totalAppearances = tracks
    .filter((track) => track.category === category)
    .reduce((sum, track) => sum + track.appearsFrames, 0);
  return clamp01(totalAppearances / totalSamples);
}

const EMPTY_FEATURES: OcrFeatures = {
  subtitleCoverageRate: null,
  slidePresenceRate: null,
  captionRate: null,
  logoPresenceRate: null,
  priceMentionRate: null,
  nameMentionRate: null,
  dominantTextCategory: null,
  averageTextBlockCount: null,
};

// Pure, synchronous. `totalSamples` is the ORIGINAL raw ocrText sample
// count (not tracks.length) - needed to turn per-category appearance
// counts into rates comparable across clips of different lengths. Zero
// (not null) rates are real when totalSamples > 0 but a category simply
// never appeared - null is reserved for "no samples were ever taken at
// all" (total detection failure), same distinction as every other
// *Features module in this pipeline.
export function deriveOcrFeatures(tracks: OcrTextTrack[], totalSamples: number): OcrFeatures {
  if (totalSamples === 0) return EMPTY_FEATURES;

  const subtitleCoverageRate = coverageRateFor(tracks, 'subtitle', totalSamples);
  const slidePresenceRate = coverageRateFor(tracks, 'slide', totalSamples);
  const captionRate = coverageRateFor(tracks, 'caption', totalSamples);
  const logoPresenceRate = coverageRateFor(tracks, 'logo', totalSamples);
  const priceMentionRate = coverageRateFor(tracks, 'price', totalSamples);
  const nameMentionRate = coverageRateFor(tracks, 'name', totalSamples);

  // First-occurrence tie-break (walking `tracks` in their own order, not
  // OCR_TEXT_CATEGORIES' declared order) - same convention as
  // dominantEmotion/dominantGesture/dominantLookingDirection elsewhere in
  // this pipeline.
  let dominantTextCategory: OcrTextCategory | null = null;
  if (tracks.length > 0) {
    const weightedCounts = new Map<OcrTextCategory, number>();
    for (const track of tracks) {
      weightedCounts.set(
        track.category,
        (weightedCounts.get(track.category) ?? 0) + track.appearsFrames,
      );
    }
    dominantTextCategory = tracks[0].category;
    let dominantWeight = 0;
    for (const track of tracks) {
      const weight = weightedCounts.get(track.category) ?? 0;
      if (weight > dominantWeight) {
        dominantWeight = weight;
        dominantTextCategory = track.category;
      }
    }
  }

  const averageTextBlockCount =
    tracks.reduce((sum, track) => sum + track.appearsFrames, 0) / totalSamples;

  return {
    subtitleCoverageRate,
    slidePresenceRate,
    captionRate,
    logoPresenceRate,
    priceMentionRate,
    nameMentionRate,
    dominantTextCategory,
    averageTextBlockCount,
  };
}
