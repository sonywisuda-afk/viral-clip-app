import type { AudioFeatures, FaceLandmarkFeatures, GestureFeatures } from '@speedora/contracts';

// Shared across this package's spec files (unlike @speedora/facial-
// intelligence's own spec files, which each redeclare their own fixture -
// FaceLandmarkFeatures' 30+ nullable fields make that duplication risky
// here, so this one small file is shared instead). Excluded from
// tsconfig.build.json only by virtue of never being imported by src/
// index.ts - not a .spec.ts file itself, so jest's testRegex doesn't run
// it directly.
export const NULL_FACE_FEATURES: FaceLandmarkFeatures = {
  blinkRate: null,
  averageSmile: null,
  averageMouthOpen: null,
  averageAbsoluteYaw: null,
  averageAbsolutePitch: null,
  positionScore: null,
  sizeScore: null,
  visibilityScore: null,
  eyeContactRate: null,
  dominantLookingDirection: null,
  averageSharpness: null,
  averageBrightness: null,
  occlusionRate: null,
  speakerChangeCount: null,
  dominantSpeakerConsistency: null,
  speakerAudioSyncRate: null,
  averageLipVelocity: null,
  speakingIntensity: null,
  pauseCount: null,
  articulationRate: null,
  averageMouthWidth: null,
  averageCheekRaise: null,
  averageEyeSquint: null,
  genuineSmileRate: null,
  blinkFrequencyPerMinute: null,
  prolongedClosureCount: null,
  gazeStabilityScore: null,
  averageBrowActivity: null,
  averageHeadMovementRate: null,
  dominantAffect: null,
  affectConfidence: null,
};

export const NULL_GESTURE_FEATURES: GestureFeatures = {
  dominantGesture: null,
  gestureTransitions: 0,
  peakConfidence: null,
  stability: null,
};

export const NULL_AUDIO_FEATURES: AudioFeatures = {
  averageRmsDb: null,
  peakDb: null,
  averageSpeakingRateWordsPerSecond: null,
  speakingRateStdDev: null,
};
