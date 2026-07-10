import type {
  AudioFeatures,
  FaceLandmarkFeatures,
  GestureFeatures,
  SpeakerEngagementScore,
} from '@speedora/contracts';
import { averageAvailable, speakingActivityScore, voiceEnergyScore } from './normalize';

// Speaker Intelligence roadmap, Milestone C - Speaker Engagement. Same
// "already scoped to one speaker by the caller" contract as
// deriveSpeakerConfidenceScore.
export function deriveSpeakerEngagementScore(
  speakerId: string,
  faceFeatures: FaceLandmarkFeatures | null,
  gestureFeatures: GestureFeatures | null,
  voiceFeatures: AudioFeatures | null,
): SpeakerEngagementScore {
  const gestureScore = gestureFeatures?.peakConfidence ?? null;
  const voiceEnergyScoreValue =
    voiceFeatures?.averageRmsDb != null ? voiceEnergyScore(voiceFeatures.averageRmsDb) : null;
  // A coarse "expressiveness" composite - averageSmile and
  // averageBrowActivity are both already 0-1 by contract
  // (FaceLandmarkFeatures), reused directly rather than re-deriving
  // anything from raw blendshapes.
  const facialExpressionScore = averageAvailable([
    faceFeatures?.averageSmile ?? null,
    faceFeatures?.averageBrowActivity ?? null,
  ]);
  const speakingRateScore =
    voiceFeatures?.averageSpeakingRateWordsPerSecond != null
      ? speakingActivityScore(voiceFeatures.averageSpeakingRateWordsPerSecond)
      : null;

  return {
    speakerId,
    gestureScore,
    voiceEnergyScore: voiceEnergyScoreValue,
    facialExpressionScore,
    speakingRateScore,
    overallScore: averageAvailable([
      gestureScore,
      voiceEnergyScoreValue,
      facialExpressionScore,
      speakingRateScore,
    ]),
  };
}
