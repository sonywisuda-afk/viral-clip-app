import { z } from 'zod';

// AI Fusion roadmap's OCR initiative, Batch OCR-1 - Tesseract-based on-
// screen text detection (subtitles/slides/captions/logos/prices/name
// overlays - see @speedora/facial-intelligence's sibling modules for the
// same "Python subprocess, JSON stdout" convention). This batch is
// DELIBERATELY scoped to raw detection only (text + bounding box +
// confidence per sampled frame) - user's own staged roadmap: OCR-1 (this
// one) → OCR-2 (cross-frame tracking + rule-based category classification)
// → OCR-3 (object-detector integration for nearObject/objectClass) →
// OCR-4 (scene understanding combining face+object+OCR). No `features`/
// category schema here yet - that's OCR-2's job, once tracking data exists
// to compute duration/persistence from.

export const detectOcrTextInputSchema = z.object({
  sourcePath: z.string().min(1),
  startTime: z.number(),
  endTime: z.number(),
});

// One detected text block within a single sampled frame - Tesseract's own
// line-level grouping (block_num/par_num/line_num), not word-level (a
// whole subtitle line as one block, not one entry per word) and not full-
// page (a frame can have multiple distinct text regions - subtitle AND a
// logo AND a price tag all in the same frame - so this is an ARRAY per
// sample, unlike every other detector in this pipeline which reports at
// most one measurement per sample).
export const ocrTextBlockSchema = z.object({
  text: z.string(),
  // Normalized [0, 1] bounding box, same convention as
  // face-landmarks.ts's boundingBox (xCenter/yCenter/width/height).
  boundingBox: z.object({
    xCenter: z.number(),
    yCenter: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  // Tesseract's own per-line confidence, rescaled from its native 0-100
  // scale to 0-1 for consistency with every other confidence value in this
  // pipeline.
  confidence: z.number().min(0).max(1),
});

// A sampled frame's worth of OCR output - an EMPTY array (not null) means
// "no text found in this sampled frame", since finding zero text regions is
// an entirely ordinary, common result (most frames won't have a price tag
// or a slide), not a detection failure - a real error still fails the
// whole subprocess call rather than producing a partial/malformed sample.
export const ocrSampleSchema = z.object({
  t: z.number(),
  textBlocks: z.array(ocrTextBlockSchema),
});

export const detectOcrTextOutputSchema = z.array(ocrSampleSchema);

export type DetectOcrTextInput = z.infer<typeof detectOcrTextInputSchema>;
export type OcrTextBlock = z.infer<typeof ocrTextBlockSchema>;
export type OcrSample = z.infer<typeof ocrSampleSchema>;

// AI Fusion roadmap's OCR initiative, Batch OCR-2 - cross-frame text
// TRACKING (grouping the same physical on-screen text element across
// consecutive samples via @speedora/ocr-intelligence's trackOcrText()) and
// rule-based classification into 6 SAFE categories (classifyOcrTrack()) -
// user's own spec: "Simpan seluruh feature beserta categoryConfidence,
// sehingga jika nanti ingin beralih ke model ML" (persist every feature
// plus categoryConfidence, so this data can seed a future ML model) - this
// is why ocrTextTrackSchema below carries the FULL feature vector per
// tracked instance, not just the final aggregate rates
// (ocrFeaturesSchema further down is the aggregate; this is the per-
// instance detail behind it).

export const OCR_TEXT_CATEGORIES = [
  'subtitle',
  'slide',
  'caption',
  'logo',
  'price',
  'name',
] as const;
export type OcrTextCategory = (typeof OCR_TEXT_CATEGORIES)[number];

// Content-pattern evidence used by the rule-fusion classifier - a coarse,
// regex-based heuristic (not an NLP/NER model), same "kejujuran skala" as
// every other heuristic in this pipeline.
export const ocrRegexFlagsSchema = z.object({
  // Currency symbol/amount pattern (e.g. "$9.99", "Rp 50.000") - see
  // classify-ocr-text.ts's PRICE_REGEX for the exact (deliberately rough,
  // not exhaustive) pattern.
  isPriceLike: z.boolean(),
  // A short, Title-Cased run of words (e.g. "John Smith") - a coarse proxy
  // for "this text looks like a person's name", not real named-entity
  // recognition.
  isNameLike: z.boolean(),
});

// One tracked on-screen text element across its full lifetime in the clip
// (@speedora/ocr-intelligence's trackOcrText() groups raw per-frame
// ocrTextBlockSchema entries into this; classifyOcrTrack() then fills in
// category/categoryConfidence/classificationMethod). This is the "store
// everything" layer user asked for - every feature that fed the
// classification decision, not just the final category.
export const ocrTextTrackSchema = z.object({
  trackId: z.number().int(),
  // Representative text for this track - the FIRST sample's text, not an
  // average/merge (OCR reads of the same on-screen element can vary
  // slightly frame-to-frame from compression noise; picking one real
  // observed reading is more honest than fabricating a "canonical" merge).
  text: z.string(),
  // Representative (average across all appearances) bounding box/
  // confidence - same normalized [0,1] convention as ocrTextBlockSchema.
  boundingBox: z.object({
    xCenter: z.number(),
    yCenter: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  confidence: z.number().min(0).max(1),
  // Clip-relative seconds of this track's first/last appearance.
  startTime: z.number(),
  endTime: z.number(),
  // endTime - startTime - the SPAN this track covers, which can be larger
  // than appearsFrames-worth-of-samples if the track survived a brief gap
  // (a miss tolerance, see MAX_MISS_SAMPLES in track-ocr-text.ts) - NOT
  // the same thing as appearsFrames * sample interval.
  durationSeconds: z.number().min(0),
  appearsFrames: z.number().int().min(1),
  // appearsFrames / total samples in the WHOLE clip (not just this
  // track's own span) - "what fraction of the entire clip was this
  // element visible for". 1.0 means present in literally every sampled
  // frame (a typical logo/watermark).
  persistenceScore: z.number().min(0).max(1),
  // Average frame-to-frame bounding-box-center movement across this
  // track's own appearances, normalized - 0 for a perfectly static
  // element (logo, slide), higher for scrolling/moving text (e.g. rolling
  // credits). Null when this track only appeared in a single frame
  // (nothing to measure movement between).
  motionScore: z.number().min(0).max(1).nullable(),
  // Whether this track's bounding box was near a detected face's bounding
  // box at a matching timestamp - null when no face bounding-box data was
  // supplied to classifyOcrTrack()/deriveOcrFeatures() at all (an optional
  // parameter, same "narrow input contract" pattern as
  // @speedora/facial-intelligence's AudioActivityWindow), not merely
  // inconclusive.
  nearFace: z.boolean().nullable(),
  // ALWAYS null in this batch - Tesseract here is configured English-only
  // (see Dockerfile's tesseract-ocr-eng), and no per-block language
  // identification is performed at all. Kept as an honest placeholder
  // field (not omitted) so a real value can be added later without a
  // schema-shape change, same "reserved key" precedent as
  // fusionWeightsSchema's own `ocr` slot before this initiative existed.
  language: z.string().nullable(),
  regexFlags: ocrRegexFlagsSchema,
  category: z.enum(OCR_TEXT_CATEGORIES),
  // The winning category's own score from the rule-fusion step (see
  // classify-ocr-text.ts) - a heuristic weighted-rule score in [0,1], NOT
  // a calibrated statistical probability.
  categoryConfidence: z.number().min(0).max(1),
  // Always "HybridRuleEngine" in this batch (deterministic weighted rules
  // over position/size/regex/persistence/motion/nearFace) - a literal
  // string field (not just a comment) so a future trained-model
  // classifier can be distinguished from this one in the SAME persisted
  // shape without a schema migration.
  classificationMethod: z.literal('HybridRuleEngine'),
});

export type OcrRegexFlags = z.infer<typeof ocrRegexFlagsSchema>;
export type OcrTextTrack = z.infer<typeof ocrTextTrackSchema>;

// Aggregate, Fusion-Engine-ready summary derived from the classified
// tracks above (@speedora/ocr-intelligence's deriveOcrFeatures()) - the
// dense per-clip numbers computeHighlightScore actually consumes, same
// "raw/tracks/features" layering as every other *Features schema in this
// pipeline (raw = ocrSampleSchema, tracks = ocrTextTrackSchema, features =
// this). All null when zero samples were ever taken (total detection
// failure) - a rate of exactly 0 is a real, meaningful value (e.g. "no
// price was ever shown"), not "unknown".
export const ocrFeaturesSchema = z.object({
  // Fraction of ALL sampled frames where at least one track of this
  // category was visible - a rate, not a count, so it's comparable across
  // clips of different lengths (same convention as blinkRate/
  // eyeContactRate elsewhere in this pipeline).
  subtitleCoverageRate: z.number().min(0).max(1).nullable(),
  slidePresenceRate: z.number().min(0).max(1).nullable(),
  captionRate: z.number().min(0).max(1).nullable(),
  logoPresenceRate: z.number().min(0).max(1).nullable(),
  priceMentionRate: z.number().min(0).max(1).nullable(),
  nameMentionRate: z.number().min(0).max(1).nullable(),
  // Most frequent category among ALL tracks (by appearsFrames-weighted
  // count, not just track count, so one long-lived logo outweighs several
  // one-frame OCR misreads) - ties broken by first occurrence, same
  // convention as dominantEmotion/dominantGesture elsewhere. Null when
  // zero tracks were ever found in the whole clip.
  dominantTextCategory: z.enum(OCR_TEXT_CATEGORIES).nullable(),
  // Average number of text blocks detected per sampled frame - raw units
  // (a density, not yet 0-1 bounded), normalized later in fusion-engine,
  // same convention as averageSharpness/averageAbsoluteYaw elsewhere. A
  // general "how much on-screen text is there at all" signal.
  averageTextBlockCount: z.number().min(0).nullable(),
});

export type OcrFeatures = z.infer<typeof ocrFeaturesSchema>;

// AI Fusion roadmap's OCR initiative, Batch OCR-2.5 (Calibration &
// Evaluation) - the ground-truth annotation format a human reviewer
// produces when labeling exported ocrTextTrackSchema entries (see
// @speedora/ocr-intelligence's evaluateOcrClassification()). `track` is a
// classifier PREDICTION (classifyOcrTrack()'s own output, category/
// categoryConfidence already filled in); `actualCategory` is the one field a
// human adds. Defined here (not in ocr-intelligence itself) so a consumer
// (e.g. a CLI script) can validate an externally-produced file against this
// schema without needing `zod` as its own dependency.
export const ocrLabeledTrackSchema = z.object({
  track: ocrTextTrackSchema,
  actualCategory: z.enum(OCR_TEXT_CATEGORIES),
});

export type OcrLabeledTrack = z.infer<typeof ocrLabeledTrackSchema>;
