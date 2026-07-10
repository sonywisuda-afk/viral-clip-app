import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { diarizeSpeakersOutputSchema, type SpeakerTurn } from '@speedora/contracts';

const execFileAsync = promisify(execFile);
const PYTHON_PATH = process.env.PYTHON_PATH ?? 'python3';
const SCRIPT_PATH = path.join(__dirname, '../scripts/diarize_speakers.py');

export type { SpeakerTurn };

// Shells out to scripts/diarize_speakers.py exactly like faceDetection.ts
// shells out to detect_faces.py - pyannote.audio's own story is
// Python-first, no maintained Node equivalent. audioPath must be a local
// file (same constraint as ffmpeg/MediaPipe - no seeking directly against
// object storage).
//
// HUGGINGFACE_TOKEN is read by the Python script itself from its inherited
// environment (execFile passes the parent process's env by default) -
// deliberately NOT passed as a CLI arg, so it never appears in argv/process
// listings/error logs the way a plain string argument could.
//
// Throws (doesn't swallow) when the token is missing or the gated model's
// terms haven't been accepted on Hugging Face - the caller
// (transcribe.worker.ts) is responsible for catching this and falling back
// to "no speaker labels" for the whole video, same "don't fail the job over
// an optional signal" pattern as detectFaces's caller in
// render-clip.worker.ts.
export async function diarizeSpeakers(audioPath: string): Promise<SpeakerTurn[]> {
  const { stdout } = await execFileAsync(PYTHON_PATH, [SCRIPT_PATH, audioPath]);
  return diarizeSpeakersOutputSchema.parse(JSON.parse(stdout));
}

// "Speaker A", "Speaker B", ... in order of first appearance - friendlier
// than pyannote's raw "SPEAKER_00"/"SPEAKER_01" IDs, which are meaningless
// to an end user and not stable/comparable across different videos anyway
// (so there's no reason to expose the raw ID at all). Falls back to a
// plain number past Z - 26+ distinct speakers in one clip is not a realistic
// case this needs to look nice for.
function friendlyLabel(index: number): string {
  return index < 26 ? `Speaker ${String.fromCharCode(65 + index)}` : `Speaker ${index + 1}`;
}

// The overlap-majority approach shared by assignSpeakerLabels/
// toFriendlySpeakerTurns below: each segment gets whichever speaker's turn
// covers the largest slice of its own [start, end) - segments are Whisper's
// own sentence-ish chunks, which only rarely straddle an actual speaker
// change, so "largest overlap wins" is a reasonable single label per segment
// rather than needing per-word speaker assignment. undefined when no turn
// overlaps this segment at all.
function bestSpeakerPerSegment(
  segments: Array<{ start: number; end: number }>,
  turns: SpeakerTurn[],
): Array<string | undefined> {
  return segments.map((segment) => {
    let bestOverlapSeconds = 0;
    let bestSpeaker: string | undefined;
    for (const turn of turns) {
      const overlap = Math.min(segment.end, turn.end) - Math.max(segment.start, turn.start);
      if (overlap > bestOverlapSeconds) {
        bestOverlapSeconds = overlap;
        bestSpeaker = turn.speaker;
      }
    }
    return bestSpeaker;
  });
}

// Raw speaker ID -> friendly label, built in order of first appearance
// ACROSS SEGMENTS (not turn order - see assignSpeakerLabels' own history:
// a segment's best-overlap speaker is what "first appearance" means here,
// consistent with what actually gets persisted to TranscriptSegment.speaker).
function buildRawToFriendlyLabelMap(bestSpeakers: Array<string | undefined>): Map<string, string> {
  const rawToLabel = new Map<string, string>();
  for (const raw of bestSpeakers) {
    if (raw !== undefined && !rawToLabel.has(raw)) {
      rawToLabel.set(raw, friendlyLabel(rawToLabel.size));
    }
  }
  return rawToLabel;
}

// One label per segment, aligned by index to `segments` - undefined for a
// segment no diarization turn overlaps at all (diarization was skipped
// entirely, giving turns=[], or there's a gap in turn coverage).
export function assignSpeakerLabels(
  segments: Array<{ start: number; end: number }>,
  turns: SpeakerTurn[],
): Array<string | undefined> {
  const bestSpeakers = bestSpeakerPerSegment(segments, turns);
  const rawToLabel = buildRawToFriendlyLabelMap(bestSpeakers);
  return bestSpeakers.map((raw) => (raw === undefined ? undefined : rawToLabel.get(raw)));
}

// Speaker Intelligence roadmap, Milestone B - relabels diarizeSpeakers()'s
// own raw turns ("SPEAKER_00") with the SAME friendly "Speaker A"/"Speaker B"
// labels assignSpeakerLabels() assigns to transcript segments, built from
// the IDENTICAL rawToLabel mapping (not independently re-derived from turn
// order) - so a turn's label here always matches whatever
// TranscriptSegment.speaker says for the same stretch of audio. A raw
// speaker assignSpeakerLabels never actually used (no segment's best-
// overlap turn ever pointed at it) is dropped from the result entirely,
// not given a label nothing in the transcript would ever show.
export function toFriendlySpeakerTurns(
  segments: Array<{ start: number; end: number }>,
  turns: SpeakerTurn[],
): SpeakerTurn[] {
  const rawToLabel = buildRawToFriendlyLabelMap(bestSpeakerPerSegment(segments, turns));
  return turns
    .filter((turn) => rawToLabel.has(turn.speaker))
    .map((turn) => ({ ...turn, speaker: rawToLabel.get(turn.speaker)! }));
}
