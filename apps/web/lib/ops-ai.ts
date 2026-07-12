// Milestone 5C-B (AI Operations Dashboard) - pure, no-JSX display helpers,
// same "testable without a component-testing framework" reasoning as
// lib/explainability.ts/lib/analytics.ts.

// Human-readable label per v2 FUSION_SIGNAL key (packages/shared types
// `FusionContribution.signal` as a plain string, not a literal union, so
// this map is keyed loosely too). `facial` -> 'Emotion' deliberately
// matches packages/contracts/src/fusion-ml.ts's FUSION_V2_TO_V3_SIGNAL_MAP
// rename (the same signal, renamed for v3) - display-only, doesn't change
// what's stored or how M5B's "Most Common Signals" (raw v2 keys) reads.
const SIGNAL_DISPLAY_LABELS: Record<string, string> = {
  audio: 'Audio',
  scene: 'Scene',
  sceneMotion: 'Scene Motion',
  cameraMotion: 'Camera Motion',
  editingRhythm: 'Editing Rhythm',
  facial: 'Emotion',
  gesture: 'Gesture',
  faceGeometry: 'Face Geometry',
  ocr: 'OCR',
  object: 'Object',
  llm: 'LLM',
  speaker: 'Speaker',
  composition: 'Composition',
};

// Falls back to the raw key for a signal this map doesn't know about yet,
// rather than crashing - defensive against a new signal being added to
// FUSION_SIGNALS without this map being updated in the same PR.
export function signalLabel(signal: string): string {
  return SIGNAL_DISPLAY_LABELS[signal] ?? signal;
}

export function formatPct(pct: number): string {
  return `${Math.round(pct)}%`;
}

// Same [0, 100] clamp posture as lib/analytics.ts's toBarPercent, for a bar
// width driven by a bucket count relative to the largest bucket in its
// histogram.
export function toBarPercent(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(Math.min(1, Math.max(0, count / max)) * 100);
}
