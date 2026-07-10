import {
  analyzeMotionEnergyInputSchema,
  analyzeMotionEnergyOutputSchema,
  type AnalyzeMotionEnergyInput,
  type AnalyzeMotionEnergyOutput,
  type MotionEnergySample,
} from '@speedora/contracts';
import type { ExecFileFn } from './detect-scene-cuts';

export type { MotionEnergySample };

export interface AnalyzeMotionEnergyDeps {
  execFile: ExecFileFn;
  // Same deployment-plumbing reasoning as detectSceneCuts'/
  // classifySceneCutTypes' own Deps interfaces - never read from
  // process.env inside this module itself.
  ffmpegPath: string;
}

// 1 sample/second - same sampling cadence @speedora/reframe's face
// detection and @speedora/facial-intelligence/@speedora/gesture-intelligence
// already use, so a clip's motion-energy timeline lines up with every other
// per-clip sampled signal at a glance. `fps=1` (applied BEFORE signalstats)
// means the motion measured at each sample is "how much changed since ~1
// second ago", a coarser but bounded-size measurement - not true frame-to-
// frame motion at the source frame rate, which would produce an unbounded
// number of raw samples for a long clip.
const MOTION_SAMPLE_INTERVAL_SECONDS = 1;

// ffmpeg's `metadata` filter in `print` mode is purpose-built for exactly
// this - extracting one computed statistic (signalstats' YDIF, mean
// absolute luma difference from the previous frame) per frame in a simple,
// documented two-line-per-frame format - chosen over parsing showinfo's
// dense single-line metadata dump (what detectSceneCuts/classifySceneCutTypes
// use for pts_time, a simpler single value) because YDIF isn't part of
// showinfo's own fixed field set, it's attached by signalstats as frame
// side-data that showinfo would otherwise need a more fragile nested-format
// parse to extract.
const METADATA_KEY = 'lavfi.signalstats.YDIF';

const FRAME_LINE_PATTERN = /pts_time:\s*(-?\d+(?:\.\d+)?)/;
const METADATA_VALUE_PATTERN = /lavfi\.signalstats\.YDIF=(-?\d+(?:\.\d+)?)/;

function parseMotionEnergySamples(stderr: string): MotionEnergySample[] {
  const samples: MotionEnergySample[] = [];
  let pendingTime: number | null = null;

  for (const line of stderr.split('\n')) {
    const frameMatch = FRAME_LINE_PATTERN.exec(line);
    if (frameMatch) {
      pendingTime = Number.parseFloat(frameMatch[1]);
      continue;
    }
    const valueMatch = METADATA_VALUE_PATTERN.exec(line);
    if (valueMatch && pendingTime !== null) {
      samples.push({ t: pendingTime, motionEnergy: Number.parseFloat(valueMatch[1]) });
      pendingTime = null;
    }
  }

  return samples;
}

// Batch SC-2 (Scene Intelligence taxonomy expansion, continuing Batch SC-1) -
// measures motion MAGNITUDE (not direction - see this module's own
// contracts comment for why Camera Pan/Tilt/Zoom/Shake are a separate,
// harder, not-yet-built signal) across a clip's own time range, via ffmpeg's
// `signalstats` filter.
//
// PENDING REAL-MACHINE VERIFICATION, same caveat as detectSceneCuts/
// classifySceneCutTypes: this sandbox has no ffmpeg on PATH, so the
// `metadata=print`stderr format parsed here is based on documented ffmpeg
// output, not a real run.
export async function analyzeMotionEnergy(
  input: AnalyzeMotionEnergyInput,
  deps: AnalyzeMotionEnergyDeps,
): Promise<AnalyzeMotionEnergyOutput> {
  const { videoPath, startTime, endTime } = analyzeMotionEnergyInputSchema.parse(input);

  try {
    const { stderr } = await deps.execFile(deps.ffmpegPath, [
      '-ss',
      startTime.toString(),
      '-to',
      endTime.toString(),
      '-i',
      videoPath,
      '-vf',
      `fps=${MOTION_SAMPLE_INTERVAL_SECONDS},signalstats,metadata=print:key=${METADATA_KEY}`,
      '-f',
      'null',
      '-',
    ]);
    return analyzeMotionEnergyOutputSchema.parse({ samples: parseMotionEnergySamples(stderr) });
  } catch {
    // A failed ffmpeg call never fails the whole clip - same "optional
    // signal" pattern as detectSceneCuts/classifySceneCutTypes.
    return analyzeMotionEnergyOutputSchema.parse({ samples: [] });
  }
}
