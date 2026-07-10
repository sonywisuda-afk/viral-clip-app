import {
  classifySceneCutTypesInputSchema,
  classifySceneCutTypesOutputSchema,
  type ClassifySceneCutTypesInput,
  type ClassifySceneCutTypesOutput,
  type SceneCutEvent,
} from '@speedora/contracts';
import type { ExecFileFn } from './detect-scene-cuts';

export type { SceneCutEvent };

export interface ClassifySceneCutTypesDeps {
  execFile: ExecFileFn;
  // Same deployment-plumbing reasoning as detectSceneCuts' own
  // DetectSceneCutsDeps - never read from process.env inside this module
  // itself.
  ffmpegPath: string;
}

// A cut within this many seconds of a blackdetect'd black interval boundary
// is classified as a "fade" (a transition through black) rather than a hard
// cut - a reasonable guess (typical fade durations are well under a
// second), not calibrated against real footage, same "kejujuran skala" as
// every other threshold in this codebase's ffmpeg-based detectors.
const FADE_PROXIMITY_SECONDS = 0.5;

// ffmpeg's own blackdetect filter defaults are more conservative than this
// (d=2.0) - lowered here because a fade transition is usually much shorter
// than 2 seconds and this project only cares about brief black intervals
// that coincide with an already-detected cut, not sustained black frames.
const BLACK_MIN_DURATION_SECONDS = 0.1;
const BLACK_PICTURE_THRESHOLD = 0.98;

const BLACK_INTERVAL_PATTERN = /black_start:\s*(-?\d+(?:\.\d+)?)\s+black_end:\s*(-?\d+(?:\.\d+)?)/g;

interface BlackInterval {
  start: number;
  end: number;
}

function parseBlackIntervals(stderr: string): BlackInterval[] {
  BLACK_INTERVAL_PATTERN.lastIndex = 0;
  const intervals: BlackInterval[] = [];
  let match: RegExpExecArray | null;
  while ((match = BLACK_INTERVAL_PATTERN.exec(stderr)) !== null) {
    intervals.push({ start: Number.parseFloat(match[1]), end: Number.parseFloat(match[2]) });
  }
  return intervals;
}

function isNearBlackInterval(t: number, intervals: BlackInterval[]): boolean {
  return intervals.some(
    (interval) =>
      Math.abs(t - interval.start) <= FADE_PROXIMITY_SECONDS ||
      Math.abs(t - interval.end) <= FADE_PROXIMITY_SECONDS,
  );
}

function asHardCutEvents(cuts: number[]): SceneCutEvent[] {
  return cuts.map((t) => ({ t, type: 'hard_cut' as const }));
}

// Batch SC-1 (Scene Intelligence taxonomy expansion, on top of Fase 26's
// detectSceneCuts) - classifies each cut already found by detectSceneCuts
// as a hard cut vs. a fade (a transition through black), via ffmpeg's
// `blackdetect` filter over the same clip range. Doesn't re-detect cuts
// itself - `input.cuts` is expected to be detectSceneCuts' own output for
// the same [startTime, endTime) range. `dissolve` is part of the taxonomy
// but never produced by this batch (see contracts' sceneCutEventSchema
// comment) - every cut here resolves to either 'hard_cut' or 'fade'.
//
// PENDING REAL-MACHINE VERIFICATION, same caveat as detectSceneCuts itself:
// this sandbox has no ffmpeg on PATH, so the blackdetect stderr format
// parsed here is based on documented ffmpeg output, not a real run.
export async function classifySceneCutTypes(
  input: ClassifySceneCutTypesInput,
  deps: ClassifySceneCutTypesDeps,
): Promise<ClassifySceneCutTypesOutput> {
  const { videoPath, startTime, endTime, cuts } = classifySceneCutTypesInputSchema.parse(input);

  if (cuts.length === 0) {
    return classifySceneCutTypesOutputSchema.parse({ events: [] });
  }

  try {
    const { stderr } = await deps.execFile(deps.ffmpegPath, [
      '-ss',
      startTime.toString(),
      '-to',
      endTime.toString(),
      '-i',
      videoPath,
      '-vf',
      `blackdetect=d=${BLACK_MIN_DURATION_SECONDS}:pic_th=${BLACK_PICTURE_THRESHOLD}`,
      '-f',
      'null',
      '-',
    ]);
    const blackIntervals = parseBlackIntervals(stderr);
    const events: SceneCutEvent[] = cuts.map((t) => ({
      t,
      type: isNearBlackInterval(t, blackIntervals) ? 'fade' : 'hard_cut',
    }));
    return classifySceneCutTypesOutputSchema.parse({ events });
  } catch {
    // A failed ffmpeg call never fails the whole clip - same "optional
    // signal" pattern as detectSceneCuts itself. Falling back to 'hard_cut'
    // for every cut is the conservative default: it's what deriveSceneFeatures
    // already assumes when no classification data is supplied at all (see
    // its own comment), so a failed classification pass degrades to exactly
    // the same result as never having run it.
    return classifySceneCutTypesOutputSchema.parse({ events: asHardCutEvents(cuts) });
  }
}
