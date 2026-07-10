import type { AudioActivityWindow } from '@speedora/facial-intelligence';

// Same threshold @speedora/facial-intelligence's deriveFaceLandmarkFeatures
// uses for its own speakerAudioSyncRate/speakingIntensity/pauseCount
// (MOUTH_ACTIVITY_THRESHOLD, not exported from that module) - duplicated
// here rather than imported, same "small cross-package literal duplication"
// precedent as packages/shared's type mirrors. Kept in sync by convention,
// not a shared import - see docs/ai/speaker-intelligence.md. Shared by this
// package's own modules (detect-active-speaker.ts, verify-lip-sync.ts)
// rather than each redeclaring it.
export const MOUTH_ACTIVITY_THRESHOLD = 0.15;

export function audioActiveAt(windows: AudioActivityWindow[], t: number): boolean | null {
  const window = windows.find((w) => t >= w.start && t < w.end);
  return window ? window.hasAudio : null;
}
