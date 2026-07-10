import type { FusionPrediction, FusionRecommendation } from '@speedora/contracts';
import type { WeightedFeature } from './feature-pipeline';

// Step 8: Recommendation. Turns the prediction bucket into one concrete,
// actionable next step - for a low-performing clip, derived from the
// single WEAKEST weighted contribution (the "biggest lever" among the
// signals that actually counted toward the score), not just the bucket
// alone. Deterministic mapping, not a trained model - same honesty as the
// rest of this engine.
const ACTION_BY_FEATURE: Record<string, string> = {
  averageRmsDb: 'boost_audio_energy',
  speakingRateStdDev: 'vary_pacing',
  cutsPerMinute: 'add_visual_dynamism',
  averageMotionEnergy: 'add_visual_dynamism',
  dynamicRatio: 'add_visual_dynamism',
  panScore: 'review_manually',
  tiltScore: 'review_manually',
  zoomScore: 'review_manually',
  shakeScore: 'review_manually',
  dominantMotionTypeWeight: 'review_manually',
  tempoScore: 'add_visual_dynamism',
  pacingScore: 'review_manually',
  accelerationScore: 'review_manually',
  dominantEmotionWeight: 'add_hook',
  dominantGestureWeight: 'add_hook',
  peakConfidence: 'review_manually',
  stability: 'review_manually',
  blinkRate: 'review_manually',
  averageSmile: 'add_hook',
  averageMouthOpen: 'review_manually',
  positionScore: 'reframe_shot',
  sizeScore: 'reframe_shot',
  visibilityScore: 'reframe_shot',
  averageAbsoluteYaw: 'reframe_shot',
  averageAbsolutePitch: 'reframe_shot',
  eyeContactRate: 'add_hook',
  dominantLookingDirectionWeight: 'add_hook',
  averageSharpness: 'reframe_shot',
  averageBrightness: 'reframe_shot',
  occlusionRate: 'reframe_shot',
  speakerChangeCount: 'review_manually',
  dominantSpeakerConsistency: 'reframe_shot',
  speakerAudioSyncRate: 'reframe_shot',
  averageLipVelocity: 'add_hook',
  speakingIntensity: 'add_hook',
  pauseCount: 'review_manually',
  articulationRate: 'add_hook',
  averageMouthWidth: 'add_hook',
  averageCheekRaise: 'add_hook',
  averageEyeSquint: 'add_hook',
  genuineSmileRate: 'add_hook',
  blinkFrequencyPerMinute: 'review_manually',
  prolongedClosureCount: 'review_manually',
  gazeStabilityScore: 'add_hook',
  averageBrowActivity: 'add_hook',
  averageHeadMovementRate: 'add_hook',
  dominantAffectWeight: 'add_hook',
  affectConfidence: 'review_manually',
  subtitleCoverageRate: 'add_hook',
  slidePresenceRate: 'clarify_takeaway',
  captionRate: 'add_hook',
  logoPresenceRate: 'review_manually',
  priceMentionRate: 'strengthen_cta',
  nameMentionRate: 'review_manually',
  dominantTextCategoryWeight: 'add_hook',
  averageTextBlockCount: 'review_manually',
  'engagement.hookStrength': 'add_hook',
  'engagement.curiosity': 'add_hook',
  'engagement.emotion': 'add_hook',
  'engagement.storytelling': 'tighten_story',
  'knowledge.educationalValue': 'clarify_takeaway',
  'knowledge.practicalValue': 'add_actionable_steps',
  'knowledge.novelty': 'clarify_takeaway',
  'knowledge.trustAuthority': 'clarify_takeaway',
  'conversion.ctaStrength': 'strengthen_cta',
};

const MESSAGE_BY_FEATURE: Record<string, string> = {
  averageRmsDb:
    'Vocal energy is low - consider a louder/more energetic take or normalizing audio levels.',
  speakingRateStdDev:
    'Delivery pace is flat - varying speaking rate can make the clip feel more dynamic.',
  cutsPerMinute: 'Visual dynamism is low - consider adding a cutaway/B-roll or a faster edit.',
  averageMotionEnergy:
    'Motion energy is low - consider a moment with more on-screen movement, or add a cutaway/B-roll.',
  dynamicRatio:
    'Most of this clip reads as visually static - consider a more dynamic moment or a faster edit.',
  panScore: 'Camera motion pattern was the weakest signal here - review this clip manually.',
  tiltScore: 'Camera motion pattern was the weakest signal here - review this clip manually.',
  zoomScore: 'Camera motion pattern was the weakest signal here - review this clip manually.',
  shakeScore:
    'Footage showed erratic/shaky motion and was the weakest signal here - review this clip manually.',
  dominantMotionTypeWeight:
    'Camera motion pattern was the weakest signal here - review this clip manually.',
  tempoScore: 'Editing tempo is low - consider a faster edit or a more energetic moment.',
  pacingScore:
    'Cut pacing was irregular and was the weakest signal here - review this clip manually.',
  accelerationScore:
    'Editing rhythm/pacing trend was the weakest signal here - review this clip manually.',
  dominantEmotionWeight:
    'Facial expression is low-arousal - consider a clip moment with a stronger reaction.',
  dominantGestureWeight:
    'Hand gestures are minimal - not necessarily a problem, but a more expressive moment could help.',
  peakConfidence:
    'Classification confidence was low for this signal - consider a clearer shot of the speaker.',
  stability: 'This signal is inconsistent across the clip - consider a more focused moment.',
  blinkRate: 'Blink rate is high - consider a moment where the speaker looks more composed.',
  averageSmile: 'Facial expression is low-energy - consider a moment with more visible warmth.',
  averageMouthOpen:
    'Mouth movement is minimal - not necessarily a problem, but a more animated moment could help.',
  positionScore: "The speaker's face is off-center - consider reframing or a different crop.",
  sizeScore:
    "The speaker's face is small in frame - consider a tighter crop or a closer camera moment.",
  visibilityScore:
    "The speaker's face is out of frame for much of this clip - consider a moment where they're more visible.",
  averageAbsoluteYaw:
    'The speaker frequently turns away from the camera - consider a moment with more direct engagement.',
  averageAbsolutePitch:
    'The speaker frequently tilts away from the camera - consider a moment with more direct engagement.',
  eyeContactRate:
    'Eye contact with the camera is low - consider a moment where the speaker looks more directly into the lens.',
  dominantLookingDirectionWeight:
    "The speaker's gaze is mostly away from the camera - consider a moment with more direct eye contact.",
  averageSharpness: 'The footage looks soft/blurry - consider a sharper source clip or a steadier shot.',
  averageBrightness:
    'Lighting is too dark or too bright - consider a moment with better-exposed lighting.',
  occlusionRate:
    "The speaker's face is frequently obstructed - consider a moment with a clearer, unobstructed view.",
  speakerChangeCount:
    'The visible speaker changes frequently in this clip - review manually to confirm the cuts are intentional.',
  dominantSpeakerConsistency:
    'The camera cuts between different visible faces often - consider a moment that stays on one speaker.',
  speakerAudioSyncRate:
    "The shown face doesn't consistently match who's speaking - consider a moment framed on the active speaker.",
  averageLipVelocity:
    'Mouth movement is subdued - consider a moment with more animated, energetic delivery.',
  speakingIntensity:
    'The mouth stays only slightly open even while talking - consider a moment with clearer, more open articulation.',
  pauseCount:
    'This clip has several sustained pauses in mouth activity - review manually to confirm they read as intentional, not dead air.',
  articulationRate:
    'Mouth movement is fairly monotonous - consider a moment with more varied, expressive delivery.',
  averageMouthWidth:
    'The smile/expression reads narrow - consider a moment with a broader, more visible smile.',
  averageCheekRaise:
    'Cheek-raise is low even during smiling moments - consider a moment with a fuller, more animated expression.',
  averageEyeSquint:
    'Eye-squint is low even during smiling moments - consider a moment with a more genuine, whole-face expression.',
  genuineSmileRate:
    'Smiling moments in this clip read as posed rather than genuine - consider a moment with a more natural, whole-face reaction.',
  blinkFrequencyPerMinute:
    'Blink rate looks unusual in this clip - review manually to confirm nothing (e.g. discomfort or a bad angle) is distracting.',
  prolongedClosureCount:
    'This clip has sustained eye-closure moments - review manually to confirm they read as intentional, not the speaker looking tired or distracted.',
  gazeStabilityScore:
    "The speaker's gaze wanders during this clip - consider a moment with a steadier, more direct look at the camera.",
  averageBrowActivity:
    'Eyebrow movement is minimal - consider a moment with a more animated, expressive face.',
  averageHeadMovementRate:
    'Head movement is minimal - consider a moment with more dynamic, engaged body language.',
  dominantAffectWeight:
    'The overall affect reads as low-energy/neutral - consider a moment with more visible energy or warmth.',
  affectConfidence:
    'Too little signal was available to read this clip\'s overall affect - review manually.',
  subtitleCoverageRate:
    'On-screen subtitles are missing or sparse - consider burning in captions for more of this clip.',
  slidePresenceRate:
    'This clip barely shows the slide/document being discussed - consider a moment where it stays on screen longer.',
  captionRate:
    'This clip has little on-screen caption/overlay text - consider adding a callout for the key point.',
  logoPresenceRate:
    'A logo/watermark is rarely or never visible in this clip - review manually to confirm branding is intact.',
  priceMentionRate:
    'No price/offer is shown on screen in this clip - consider a moment that displays the price or deal.',
  nameMentionRate:
    'No name tag/credit is shown on screen in this clip - consider adding one for credibility.',
  dominantTextCategoryWeight:
    'The dominant on-screen text in this clip is low-value (e.g. a logo) - consider a moment led by subtitles or a price/name callout instead.',
  averageTextBlockCount:
    'This clip has very little on-screen text overall - consider adding captions or a callout to boost engagement.',
  'engagement.hookStrength':
    'The opening does not grab attention strongly - consider a punchier hook line.',
  'engagement.curiosity':
    'The clip does not build much curiosity - consider teasing the payoff earlier.',
  'engagement.emotion':
    'Emotional intensity is low - consider a moment with a stronger emotional beat.',
  'engagement.storytelling':
    'The narrative arc feels underdeveloped - consider a clip with a clearer setup/payoff.',
  'knowledge.educationalValue':
    'The clip teaches little - consider a moment that explains more of the "why".',
  'knowledge.practicalValue':
    'The clip is light on directly-applicable steps - consider a moment with a clear ' +
    'how-to, example, or checklist rather than opinion/theory alone.',
  'knowledge.novelty':
    'The content feels expected rather than surprising - consider a more novel angle.',
  'knowledge.trustAuthority':
    'The speaker comes across less credible here - consider a moment establishing expertise.',
  'conversion.ctaStrength':
    'The call-to-action is weak or missing - consider adding a clear, specific ask.',
};

const DEFAULT_ACTION = 'review_manually';
const DEFAULT_MESSAGE = 'Review this clip for ways to make it more engaging.';

export function buildRecommendation(
  prediction: FusionPrediction,
  weighted: WeightedFeature[],
): FusionRecommendation {
  if (prediction.bucket === 'likely_high_performer') {
    return {
      action: 'publish_as_is',
      message: 'This clip scores well across the available signals - ready to publish as-is.',
    };
  }

  if (prediction.bucket === 'uncertain') {
    return {
      action: 'review_manually',
      message: 'Signals are mixed or incomplete - review this clip manually before publishing.',
    };
  }

  // likely_low_performer - find the single weakest scored contribution to
  // suggest a specific, targeted fix rather than a generic message.
  const scored = weighted.filter((item) => item.weight > 0);
  if (scored.length === 0) {
    return {
      action: DEFAULT_ACTION,
      message: 'No weighted signals were available - review this clip manually.',
    };
  }

  const weakest = scored.reduce((min, item) =>
    item.normalizedValue < min.normalizedValue ? item : min,
  );

  return {
    action: ACTION_BY_FEATURE[weakest.feature] ?? DEFAULT_ACTION,
    message: MESSAGE_BY_FEATURE[weakest.feature] ?? DEFAULT_MESSAGE,
  };
}
