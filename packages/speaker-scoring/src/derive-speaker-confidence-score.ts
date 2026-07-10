import type {
  AudioFeatures,
  FaceLandmarkFeatures,
  GestureFeatures,
  SpeakerConfidenceScore,
} from '@speedora/contracts';
import {
  averageAvailable,
  headPoseStabilityScore,
  speakingActivityScore,
  voiceStabilityScore,
} from './normalize';

// Speaker Intelligence roadmap, Milestone C - Speaker Confidence. All
// inputs are already scoped to ONE speaker by the caller
// (deriveClipSpeakerScores narrows faceFeatures to this speaker's own face
// track, voiceFeatures to this speaker's own transcript segments) - this
// function itself does no filtering, same "narrow input contract" pattern
// as every module in this pipeline. `gestureFeatures` may be null even
// when a face track IS available - see deriveClipSpeakerScores' own
// comment on why gesture data can't always be attributed to one speaker.
export function deriveSpeakerConfidenceScore(
  speakerId: string,
  faceFeatures: FaceLandmarkFeatures | null,
  gestureFeatures: GestureFeatures | null,
  voiceFeatures: AudioFeatures | null,
): SpeakerConfidenceScore {
  const eyeContactRate = faceFeatures?.eyeContactRate ?? null;
  const headPoseStability =
    faceFeatures?.averageHeadMovementRate != null
      ? headPoseStabilityScore(faceFeatures.averageHeadMovementRate)
      : null;
  // A coarse presence/confidence proxy (peakConfidence, already 0-1), NOT a
  // true activity-level measurement - gesture-intelligence has no "how
  // much did they gesture" field, only a per-sample classification
  // confidence.
  const gestureActivity = gestureFeatures?.peakConfidence ?? null;
  const voiceStability =
    voiceFeatures?.speakingRateStdDev != null
      ? voiceStabilityScore(voiceFeatures.speakingRateStdDev)
      : null;
  const speakingRateScore =
    voiceFeatures?.averageSpeakingRateWordsPerSecond != null
      ? speakingActivityScore(voiceFeatures.averageSpeakingRateWordsPerSecond)
      : null;

  return {
    speakerId,
    eyeContactRate,
    headPoseStability,
    gestureActivity,
    voiceStability,
    speakingRateScore,
    overallScore: averageAvailable([
      eyeContactRate,
      headPoseStability,
      gestureActivity,
      voiceStability,
      speakingRateScore,
    ]),
  };
}
