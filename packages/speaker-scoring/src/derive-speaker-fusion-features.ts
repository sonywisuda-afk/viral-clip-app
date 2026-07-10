import type { SpeakerFusionFeatures } from '@speedora/contracts';
import type { ClipSpeakerScores } from './derive-clip-speaker-scores';

// Speaker Intelligence roadmap, Milestone D - collapses deriveClipSpeakerScores'
// per-speaker/per-moment output into the single clip-level feature set
// @speedora/fusion-engine consumes as its `speaker` signal (see
// packages/contracts/src/speaker-scoring.ts's speakerFusionFeaturesSchema).
// `dominantSpeaker*` means "whichever speaker in this clip has the highest
// speakerImportanceScore" - same "dominant X" naming/selection convention
// as dominantEmotion/dominantGesture elsewhere in this pipeline (pick the
// single most-representative entity, don't average across different
// people). Falls back to the first speaker (array order) when no one has a
// non-null importance score at all, rather than reporting nothing just
// because the tie-break signal happened to be missing.
export function deriveSpeakerFusionFeatures(scores: ClipSpeakerScores): SpeakerFusionFeatures {
  const dominantSpeakerId = pickDominantSpeakerId(scores);

  const confidence = dominantSpeakerId
    ? (scores.confidence.find((c) => c.speakerId === dominantSpeakerId)?.overallScore ?? null)
    : null;
  const engagement = dominantSpeakerId
    ? (scores.engagement.find((e) => e.speakerId === dominantSpeakerId)?.overallScore ?? null)
    : null;
  const importanceScore = dominantSpeakerId
    ? (scores.importance.find((i) => i.speakerId === dominantSpeakerId)?.score ?? null)
    : null;

  const highlightScores = scores.highlightMoments
    .map((moment) => moment.score)
    .filter((score): score is number => score !== null);
  const averageHighlightScore =
    highlightScores.length === 0
      ? null
      : highlightScores.reduce((sum, score) => sum + score, 0) / highlightScores.length;

  return {
    dominantSpeakerConfidence: confidence,
    dominantSpeakerEngagement: engagement,
    // importance.score is 0-100 by contract (speakerImportanceScoreSchema),
    // normalized to 0-1 here to match every other field in this object.
    dominantSpeakerImportance: importanceScore === null ? null : importanceScore / 100,
    averageSpeakerHighlightScore:
      averageHighlightScore === null ? null : averageHighlightScore / 100,
  };
}

function pickDominantSpeakerId(scores: ClipSpeakerScores): string | null {
  if (scores.importance.length === 0) return null;

  const withScore = scores.importance.filter(
    (i): i is typeof i & { score: number } => i.score !== null,
  );
  if (withScore.length === 0) return scores.importance[0].speakerId;

  return withScore.reduce((best, current) => (current.score > best.score ? current : best))
    .speakerId;
}
