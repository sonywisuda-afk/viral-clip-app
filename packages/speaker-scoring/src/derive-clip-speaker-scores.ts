import type {
  AudioSegmentSample,
  FaceLandmarkSample,
  GestureFeatures,
  SpeakerConfidenceScore,
  SpeakerEngagementScore,
  SpeakerHighlightMoment,
  SpeakerImportanceScore,
  SpeakerTimelineEntry,
} from '@speedora/contracts';
import { deriveAudioFeatures } from '@speedora/audio-intelligence';
import {
  deriveFaceLandmarkFeatures,
  type AudioActivityWindow,
} from '@speedora/facial-intelligence';
import { buildSpeakerHighlightMoments } from './build-speaker-highlight-moments';
import { deriveSpeakerConfidenceScore } from './derive-speaker-confidence-score';
import { deriveSpeakerEngagementScore } from './derive-speaker-engagement-score';
import { deriveSpeakerImportanceScore } from './derive-speaker-importance-score';

export interface SpeakerTranscriptSegment extends AudioSegmentSample {
  speaker: string | undefined;
}

export interface ClipSpeakerScoringInput {
  // @speedora/speaker-diarization's buildSpeakerTimeline() output - already
  // clip-relative (see render-clip.worker.ts's toSpeakerTurns).
  speakerTimeline: SpeakerTimelineEntry[];
  faceLandmarks: FaceLandmarkSample[];
  audioActivity: AudioActivityWindow[];
  // This clip's own transcript segments, each carrying the speaker label
  // assignSpeakerLabels already assigned - the source of truth for per-
  // speaker voice stats (grouped by `speaker` below), not re-derived from
  // diarization turns directly.
  transcriptSegments: SpeakerTranscriptSegment[];
  // Clip-wide only - gesture-intelligence has no per-track association at
  // all (see canAttributeGesture below).
  gestureFeatures: GestureFeatures | null;
  clipDurationSeconds: number;
  // Clip-level (from clip-scoring's LLM call) - see
  // buildSpeakerHighlightMoments' own comment on why this is attached
  // uniformly rather than claimed as moment-specific.
  hookStrength: number | null;
}

export interface ClipSpeakerScores {
  confidence: SpeakerConfidenceScore[];
  engagement: SpeakerEngagementScore[];
  importance: SpeakerImportanceScore[];
  highlightMoments: SpeakerHighlightMoment[];
}

// Speaker Intelligence roadmap, Milestone C - the orchestrator that scopes
// already-collected clip-wide signals down to ONE speaker at a time, then
// hands them to the pure per-speaker scoring functions. The re-scoping
// itself is the actual new logic here: deriveFaceLandmarkFeatures() and
// deriveAudioFeatures() are REUSED, not reimplemented, run once per
// speaker over a FILTERED subset of this clip's own faceLandmarks/
// transcriptSegments (extend, don't rebuild).
export function deriveClipSpeakerScores(input: ClipSpeakerScoringInput): ClipSpeakerScores {
  const {
    speakerTimeline,
    faceLandmarks,
    audioActivity,
    transcriptSegments,
    gestureFeatures,
    clipDurationSeconds,
    hookStrength,
  } = input;

  // The face-landmark tracker (@speedora/facial-intelligence's Batch 4) is
  // SINGLE-OBJECT - it only ever follows one face at a time. When this
  // clip's faceLandmarks show more than one distinct trackId, that could
  // mean either a genuine multi-speaker clip OR just the tracker losing
  // and re-acquiring the SAME person (see face-tracking-quality.ts's
  // idSwitchCount). gesture-intelligence has no per-track association at
  // all, so attributing a clip-wide gesture reading to a SPECIFIC speaker
  // is only defensible when there's exactly one track for the whole clip -
  // any ambiguity leaves gesture-derived fields null rather than guessing.
  const distinctFaceTracks = new Set(
    faceLandmarks.filter((sample) => sample.trackId !== null).map((sample) => sample.trackId),
  );
  const canAttributeGesture = distinctFaceTracks.size === 1;

  const speakers = [...new Set(speakerTimeline.map((entry) => entry.speaker))];

  const confidence: SpeakerConfidenceScore[] = [];
  const engagement: SpeakerEngagementScore[] = [];
  const importance: SpeakerImportanceScore[] = [];

  for (const speaker of speakers) {
    const entries = speakerTimeline.filter((entry) => entry.speaker === speaker);
    const faceTrackId = entries.find((entry) => entry.faceTrackId !== null)?.faceTrackId ?? null;

    const faceSamplesForSpeaker =
      faceTrackId !== null ? faceLandmarks.filter((sample) => sample.trackId === faceTrackId) : [];
    const faceFeatures =
      faceSamplesForSpeaker.length > 0
        ? deriveFaceLandmarkFeatures(faceSamplesForSpeaker, audioActivity)
        : null;

    const gestureFeaturesForSpeaker =
      canAttributeGesture && faceTrackId !== null ? gestureFeatures : null;

    const segmentsForSpeaker = transcriptSegments.filter((segment) => segment.speaker === speaker);
    const voiceFeatures =
      segmentsForSpeaker.length > 0 ? deriveAudioFeatures(segmentsForSpeaker) : null;

    const talkTimeSeconds = entries.reduce((sum, entry) => sum + (entry.end - entry.start), 0);
    const talkTimeRatio = clipDurationSeconds > 0 ? talkTimeSeconds / clipDurationSeconds : null;
    const screenTimeRatio =
      faceLandmarks.length > 0 ? faceSamplesForSpeaker.length / faceLandmarks.length : null;

    confidence.push(
      deriveSpeakerConfidenceScore(speaker, faceFeatures, gestureFeaturesForSpeaker, voiceFeatures),
    );
    engagement.push(
      deriveSpeakerEngagementScore(speaker, faceFeatures, gestureFeaturesForSpeaker, voiceFeatures),
    );
    // role is always null here - no detector in this codebase infers it,
    // see deriveSpeakerImportanceScore's own comment. A future caller with
    // manual/publish-metadata role tagging can post-process this array.
    importance.push(deriveSpeakerImportanceScore(speaker, null, talkTimeRatio, screenTimeRatio));
  }

  const highlightMoments = buildSpeakerHighlightMoments(
    speakerTimeline,
    faceLandmarks,
    audioActivity,
    gestureFeatures,
    canAttributeGesture,
    hookStrength,
  );

  return { confidence, engagement, importance, highlightMoments };
}
