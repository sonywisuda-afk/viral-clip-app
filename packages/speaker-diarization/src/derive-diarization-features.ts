import type {
  DiarizationFeatures,
  OverlappingSpeechInterval,
  SilenceInterval,
  SpeakerSegment,
  SpeakerTurn,
} from '@speedora/contracts';

function detectOverlappingSpeech(sortedTurns: SpeakerTurn[]): OverlappingSpeechInterval[] {
  const intervals: OverlappingSpeechInterval[] = [];
  for (let i = 0; i < sortedTurns.length; i++) {
    for (let j = i + 1; j < sortedTurns.length; j++) {
      const a = sortedTurns[i];
      const b = sortedTurns[j];
      // Sorted by start - once b starts at/after a ends, no later turn (all
      // starting even later) can overlap a either.
      if (b.start >= a.end) break;
      // Same speaker "overlapping" their own two turns isn't overlapping
      // SPEECH in the sense this feature means (two people talking over
      // each other) - it's just two turns pyannote happened to split.
      if (a.speaker === b.speaker) continue;
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) intervals.push({ start, end, speakers: [a.speaker, b.speaker] });
    }
  }
  return intervals;
}

// Silence gaps are gaps in the MERGED coverage of every turn's [start, end)
// range, not just gaps between consecutive turns in the array - two turns
// from different speakers can overlap (see detectOverlappingSpeech above),
// in which case a naive "gap between consecutive turns" check would report
// a false silence that a longer, still-ongoing turn actually covers.
function detectSilences(sortedTurns: SpeakerTurn[]): SilenceInterval[] {
  const merged: Array<{ start: number; end: number }> = [];
  for (const turn of sortedTurns) {
    const last = merged[merged.length - 1];
    if (last && turn.start <= last.end) {
      last.end = Math.max(last.end, turn.end);
    } else {
      merged.push({ start: turn.start, end: turn.end });
    }
  }
  const silences: SilenceInterval[] = [];
  for (let i = 1; i < merged.length; i++) {
    silences.push({ start: merged[i - 1].end, end: merged[i].start });
  }
  return silences;
}

// Speaker Intelligence roadmap, Milestone B - Turn Detection/Silence
// Detection/Overlapping Speech Detection, all derived purely from
// diarizeSpeakers()'s own raw turn list (apps/worker/src/diarization.ts) -
// none of this was computed anywhere in this codebase before (that
// function's caller only ever consumed assignSpeakerLabels' per-Whisper-
// segment mapping, discarding the turn list itself). `turns` does not need
// to be pre-sorted - this function sorts its own working copy by start.
export function deriveDiarizationFeatures(turns: SpeakerTurn[]): DiarizationFeatures {
  const sorted = [...turns].sort((a, b) => a.start - b.start);

  const speakerCount = new Set(sorted.map((turn) => turn.speaker)).size;

  const segments: SpeakerSegment[] = sorted.map((turn) => ({
    speaker: turn.speaker,
    start: turn.start,
    end: turn.end,
    durationSeconds: turn.end - turn.start,
  }));

  const speakerDurationsSeconds: Record<string, number> = {};
  for (const segment of segments) {
    speakerDurationsSeconds[segment.speaker] =
      (speakerDurationsSeconds[segment.speaker] ?? 0) + segment.durationSeconds;
  }

  let switchCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].speaker !== sorted[i - 1].speaker) switchCount++;
  }

  return {
    speakerCount,
    segments,
    speakerDurationsSeconds,
    turnCount: sorted.length,
    switchCount,
    overlappingSpeech: detectOverlappingSpeech(sorted),
    silences: detectSilences(sorted),
  };
}
