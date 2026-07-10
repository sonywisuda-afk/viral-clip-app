import type { SpeakerTurn } from '@speedora/contracts';
import { deriveDiarizationFeatures } from './derive-diarization-features';

describe('deriveDiarizationFeatures', () => {
  it('returns all-empty/zero for no turns at all', () => {
    expect(deriveDiarizationFeatures([])).toEqual({
      speakerCount: 0,
      segments: [],
      speakerDurationsSeconds: {},
      turnCount: 0,
      switchCount: 0,
      overlappingSpeech: [],
      silences: [],
    });
  });

  it('computes speakerCount/segments/durations/turnCount for non-overlapping, back-to-back turns', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 5 },
      { speaker: 'Speaker B', start: 5, end: 8 },
      { speaker: 'Speaker A', start: 8, end: 10 },
    ];

    const result = deriveDiarizationFeatures(turns);

    expect(result.speakerCount).toBe(2);
    expect(result.turnCount).toBe(3);
    expect(result.speakerDurationsSeconds).toEqual({ 'Speaker A': 7, 'Speaker B': 3 });
    expect(result.segments).toEqual([
      { speaker: 'Speaker A', start: 0, end: 5, durationSeconds: 5 },
      { speaker: 'Speaker B', start: 5, end: 8, durationSeconds: 3 },
      { speaker: 'Speaker A', start: 8, end: 10, durationSeconds: 2 },
    ]);
  });

  it('counts a speaker switch only when the speaker actually differs from the immediately preceding turn', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 3 },
      { speaker: 'Speaker A', start: 3, end: 5 },
      { speaker: 'Speaker B', start: 5, end: 7 },
    ];

    expect(deriveDiarizationFeatures(turns).switchCount).toBe(1);
  });

  it('sorts unordered input turns by start before deriving anything', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker B', start: 5, end: 8 },
      { speaker: 'Speaker A', start: 0, end: 5 },
    ];

    expect(deriveDiarizationFeatures(turns).segments[0].speaker).toBe('Speaker A');
  });

  it('detects a silence gap between two non-overlapping turns', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 5 },
      { speaker: 'Speaker B', start: 7, end: 10 },
    ];

    expect(deriveDiarizationFeatures(turns).silences).toEqual([{ start: 5, end: 7 }]);
  });

  it('does not report a false silence when a longer turn covers the gap between two shorter ones', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 10 },
      { speaker: 'Speaker B', start: 2, end: 4 },
      { speaker: 'Speaker B', start: 12, end: 14 },
    ];

    // A covers [0,10]; B's [2,4] is nested inside it (no gap there). The
    // only real silence is between A's end (10) and the next turn (12).
    expect(deriveDiarizationFeatures(turns).silences).toEqual([{ start: 10, end: 12 }]);
  });

  it('detects overlapping speech between two different speakers, reporting the intersection', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 5 },
      { speaker: 'Speaker B', start: 3, end: 8 },
    ];

    expect(deriveDiarizationFeatures(turns).overlappingSpeech).toEqual([
      { start: 3, end: 5, speakers: ['Speaker A', 'Speaker B'] },
    ]);
  });

  it('does not report overlapping speech between two turns from the SAME speaker', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 5 },
      { speaker: 'Speaker A', start: 3, end: 8 },
    ];

    expect(deriveDiarizationFeatures(turns).overlappingSpeech).toEqual([]);
  });
});
