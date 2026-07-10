import type { LipSyncVerification } from '@speedora/contracts';
import {
  FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS,
  type AudioActivityWindow,
  type FaceLandmarkSample,
} from '@speedora/facial-intelligence';
import { audioActiveAt, MOUTH_ACTIVITY_THRESHOLD } from './mouth-activity';

// Offsets are searched in whole SAMPLE-INTERVAL steps (this pipeline
// samples at ~1/sec, see FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS below) -
// sub-second delay precision isn't meaningful at this sampling rate, an
// honest limitation, not an oversight. +-2 samples (~2s) is a reasonable
// guess at how far real AV drift could plausibly be, not calibrated.
const MAX_OFFSET_SAMPLES = 2;
// audioSyncScore at or above this, at the best-found offset, counts as
// "verified" - an unvalidated guess, same honesty as every other threshold
// in this pipeline.
const VERIFIED_SYNC_SCORE_THRESHOLD = 0.65;

function groupByTrack(samples: FaceLandmarkSample[]): Map<number, FaceLandmarkSample[]> {
  const groups = new Map<number, FaceLandmarkSample[]>();
  for (const sample of samples) {
    if (sample.trackId === null || sample.blendshapes === null) continue;
    const group = groups.get(sample.trackId) ?? [];
    group.push(sample);
    groups.set(sample.trackId, group);
  }
  return groups;
}

// Same computation as facial-intelligence's averageLipVelocity (jawOpen
// frame-to-frame delta per second) - duplicated rather than imported since
// that function isn't exported from its module, same "small cross-package
// literal duplication" precedent as mouth-activity.ts's own comment.
function averageLipVelocity(samples: FaceLandmarkSample[]): number | null {
  if (samples.length < 2) return null;
  let totalDelta = 0;
  let totalSeconds = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    const dt = cur.t - prev.t;
    if (dt <= 0) continue;
    totalDelta += Math.abs(cur.blendshapes!.jawOpen - prev.blendshapes!.jawOpen);
    totalSeconds += dt;
  }
  return totalSeconds === 0 ? null : totalDelta / totalSeconds;
}

// Agreement rate between this track's mouth activity and audio activity
// shifted by offsetSeconds - the same computation as facial-intelligence's
// speakerAudioSyncRate, scoped to one track and evaluated at a candidate
// offset instead of only at zero. Positive offsetSeconds tests "does this
// video sample's mouth activity match audio that occurs offsetSeconds
// LATER" - the convention that makes a best-fit positive offset mean
// "audio lags video" (see LipSyncVerification's own delayMs comment).
function syncScoreAtOffset(
  samples: FaceLandmarkSample[],
  audioActivity: AudioActivityWindow[],
  offsetSeconds: number,
): { score: number; evaluatedCount: number } | null {
  let agreementCount = 0;
  let evaluatedCount = 0;
  for (const sample of samples) {
    const hasAudio = audioActiveAt(audioActivity, sample.t + offsetSeconds);
    if (hasAudio === null) continue;
    const mouthActive = sample.blendshapes!.jawOpen >= MOUTH_ACTIVITY_THRESHOLD;
    if (mouthActive === hasAudio) agreementCount++;
    evaluatedCount++;
  }
  return evaluatedCount === 0 ? null : { score: agreementCount / evaluatedCount, evaluatedCount };
}

// Speaker Intelligence roadmap, Milestone A - Lip Sync Verification. Per-
// track sibling of facial-intelligence's speakerAudioSyncRate (a single
// clip-wide rate against whichever one face the tracker followed) - this
// groups samples by trackId and adds an explicit estimated AV-offset
// search on top of the same agreement-rate math.
export function verifyLipSync(
  samples: FaceLandmarkSample[],
  audioActivity: AudioActivityWindow[],
): LipSyncVerification[] {
  const tracks = groupByTrack(samples);

  return [...tracks.entries()].map(([faceTrackId, trackSamples]) => {
    const lipMotionScore = averageLipVelocity(trackSamples);

    // On a tied score, prefer whichever offset was evaluated over MORE
    // samples (stronger evidence), then whichever is closest to zero (a
    // periodic mouth-movement pattern - e.g. a steady alternating open/
    // close rhythm - can score equally well at several offsets; "assume
    // sync unless the evidence clearly favors a delay" is the more
    // conservative, less surprising default than arbitrarily reporting the
    // most negative tied offset just because it was evaluated first).
    let bestOffsetSamples = 0;
    let bestScore: number | null = null;
    let bestEvaluatedCount = 0;
    for (let offset = -MAX_OFFSET_SAMPLES; offset <= MAX_OFFSET_SAMPLES; offset++) {
      const offsetSeconds = offset * FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS;
      const result = syncScoreAtOffset(trackSamples, audioActivity, offsetSeconds);
      if (result === null) continue;
      const isBetter =
        bestScore === null ||
        result.score > bestScore ||
        (result.score === bestScore &&
          (result.evaluatedCount > bestEvaluatedCount ||
            (result.evaluatedCount === bestEvaluatedCount &&
              Math.abs(offset) < Math.abs(bestOffsetSamples))));
      if (isBetter) {
        bestScore = result.score;
        bestEvaluatedCount = result.evaluatedCount;
        bestOffsetSamples = offset;
      }
    }

    if (bestScore === null) {
      return {
        faceTrackId,
        lipMotionScore,
        audioSyncScore: null,
        delayMs: null,
        frameOffset: null,
        verified: null,
      };
    }

    return {
      faceTrackId,
      lipMotionScore,
      audioSyncScore: bestScore,
      delayMs: bestOffsetSamples * FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS * 1000,
      frameOffset: bestOffsetSamples,
      verified: bestScore >= VERIFIED_SYNC_SCORE_THRESHOLD,
    };
  });
}
