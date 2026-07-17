import type {
  CtaSection,
  FaceAnalysisSection,
  KeywordSection,
  OcrSummarySection,
  ReportClipInput,
  SpeechAnalysisSection,
} from '@speedora/contracts';

export function buildFaceAnalysisSection(clips: ReportClipInput[]): FaceAnalysisSection {
  return {
    entries: clips.map((clip) => ({ clipId: clip.id, features: clip.facialFeatures })),
  };
}

// Vocal emotion has no clip-level aggregate anywhere in the DB (unlike
// audioFeatures) - only a per-TranscriptSegment top-1 label. This is the one
// genuinely new aggregation in this module: count each label's occurrences
// among the clip's own segments (already scoped to this clip by the
// adapter, same convention as clip-scoring's segment input), pick the
// highest count, tie-broken by first appearance so the result is
// deterministic given the same segment order.
function summarizeVocalEmotion(segments: ReportClipInput['segments']): {
  dominantEmotion: string | null;
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  for (const segment of segments) {
    if (!segment.emotion) continue;
    counts[segment.emotion] = (counts[segment.emotion] ?? 0) + 1;
  }

  let dominantEmotion: string | null = null;
  let dominantCount = 0;
  for (const [emotion, count] of Object.entries(counts)) {
    if (count > dominantCount) {
      dominantEmotion = emotion;
      dominantCount = count;
    }
  }

  return { dominantEmotion, counts };
}

export function buildSpeechAnalysisSection(clips: ReportClipInput[]): SpeechAnalysisSection {
  return {
    entries: clips.map((clip) => ({
      clipId: clip.id,
      audioFeatures: clip.audioFeatures,
      vocalEmotion: summarizeVocalEmotion(clip.segments),
    })),
  };
}

export function buildOcrSummarySection(clips: ReportClipInput[]): OcrSummarySection {
  return {
    entries: clips.map((clip) => ({ clipId: clip.id, features: clip.ocrFeatures })),
  };
}

export function buildKeywordSection(clips: ReportClipInput[]): KeywordSection {
  return {
    entries: clips.map((clip) => ({
      clipId: clip.id,
      keywords: clip.keywords,
      hashtags: clip.hashtags,
      topics: clip.topics,
    })),
  };
}

// A straight read of Clip.ctaText/ClipScores.ctaStrength - both already
// computed by the frozen detect-clips LLM call (packages/clip-scoring).
// Deliberately not a new keyword-matching detector: that field already
// exists, so building one here would be redundant AND would walk toward
// AI-pipeline territory this roadmap explicitly stays out of.
export function buildCtaSection(clips: ReportClipInput[]): CtaSection {
  return {
    entries: clips.map((clip) => ({
      clipId: clip.id,
      ctaText: clip.ctaText,
      ctaStrength: clip.ctaStrength,
    })),
  };
}
