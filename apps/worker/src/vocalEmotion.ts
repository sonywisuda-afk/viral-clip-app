import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  detectVocalEmotionsOutputSchema,
  type EmotionSegment,
  type VocalEmotionResult,
} from '@speedora/contracts';
import { cleanupTempFile, reserveScratchPath } from './storage';
import { limitExecFile } from './subprocessLimiter';

const execFileAsync = limitExecFile(promisify(execFile));
const PYTHON_PATH = process.env.PYTHON_PATH ?? 'python3';
const SCRIPT_PATH = path.join(__dirname, '../scripts/detect_vocal_emotion.py');

// Same reasoning/value as diarization.ts's DIARIZATION_TIMEOUT_MS - a
// transformers audio-classification model run on CPU, with no progress
// feedback and no bound of its own, sitting after transcribe.worker.ts's
// last reportProgress() call. A timeout turns "hang forever" into an
// ordinary rejection, which the caller already treats as "skip emotion
// labels for this video".
const VOCAL_EMOTION_TIMEOUT_MS = 5 * 60 * 1000;

export type { EmotionSegment };
export type EmotionResult = NonNullable<VocalEmotionResult>;

// Shells out to scripts/detect_vocal_emotion.py exactly like
// diarization.ts/faceDetection.ts shell out to their own scripts -
// transformers' audio-classification pipeline is Python-first, no
// maintained Node equivalent. audioPath must be a local file (same
// constraint as ffmpeg/MediaPipe/pyannote - no seeking directly against
// object storage).
//
// segments needs its own temp JSON file (unlike diarizeSpeakers, which
// only takes an audio path) - the script slices audioPath itself once per
// segment rather than needing a separate audio file per segment. That temp
// file is entirely this function's own implementation detail: written,
// used, and cleaned up here, never exposed to the caller (unlike
// reframe.ts's sendcmd path, which has to outlive this function's return
// because ffmpeg reads it later - there's no such cross-call lifetime here).
//
// Result array is aligned by index to `segments` - null for a segment the
// script skipped (too short to classify meaningfully - see the script's
// MIN_SEGMENT_SECONDS).
export async function detectVocalEmotions(
  audioPath: string,
  segments: EmotionSegment[],
): Promise<Array<EmotionResult | null>> {
  const segmentsPath = await reserveScratchPath('vocal-emotion-segments', '.json');
  try {
    await writeFile(segmentsPath, JSON.stringify(segments));
    const { stdout } = await execFileAsync(PYTHON_PATH, [SCRIPT_PATH, audioPath, segmentsPath], {
      timeout: VOCAL_EMOTION_TIMEOUT_MS,
    });
    return detectVocalEmotionsOutputSchema.parse(JSON.parse(stdout));
  } finally {
    await cleanupTempFile(segmentsPath);
  }
}
