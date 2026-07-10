import type { VoiceActivityFeatures, VoiceActivitySegment } from '@speedora/contracts';

// Pure, synchronous summary derivation over detectVoiceActivity's raw
// segment timeline - separate from derive-features.ts's deriveAudioFeatures
// (which summarizes loudness/speaking-rate over TranscriptSegment rows, a
// different raw shape entirely), same "one derive-X-features file per raw
// signal" convention as @speedora/scene-intelligence's derive-motion-
// energy-features.ts / derive-camera-motion-features.ts.
export function deriveVoiceActivityFeatures(
  segments: VoiceActivitySegment[],
  durationSeconds: number,
): VoiceActivityFeatures {
  if (segments.length === 0 || durationSeconds <= 0) {
    return {
      speechRatio: null,
      silenceRatio: null,
      silenceSegmentCount: null,
      longestSilenceSeconds: null,
    };
  }

  let speechSeconds = 0;
  let silenceSeconds = 0;
  let silenceSegmentCount = 0;
  let longestSilenceSeconds = 0;

  for (const segment of segments) {
    const length = segment.end - segment.start;
    if (segment.category === 'speech') {
      speechSeconds += length;
    } else if (segment.category === 'silence') {
      silenceSeconds += length;
      silenceSegmentCount += 1;
      longestSilenceSeconds = Math.max(longestSilenceSeconds, length);
    }
  }

  return {
    speechRatio: speechSeconds / durationSeconds,
    silenceRatio: silenceSeconds / durationSeconds,
    silenceSegmentCount,
    longestSilenceSeconds,
  };
}
