import type { ActiveSpeakerSample, SpeakerTurn } from '@speedora/contracts';
import { associateSpeakersWithFaces } from './associate-speakers-with-faces';

describe('associateSpeakersWithFaces', () => {
  it('matches a speaker to the face trackId active for the majority of their turns', () => {
    const turns: SpeakerTurn[] = [{ speaker: 'Speaker A', start: 0, end: 10 }];
    const samples: ActiveSpeakerSample[] = [
      { t: 1, activeTrackId: 4, confidence: 0.5 },
      { t: 2, activeTrackId: 4, confidence: 0.6 },
      { t: 3, activeTrackId: 4, confidence: 0.4 },
      { t: 4, activeTrackId: null, confidence: null },
    ];

    const result = associateSpeakersWithFaces(turns, samples);

    expect(result).toEqual([
      { speaker: 'Speaker A', faceTrackId: 4, status: 'matched', confidence: 0.75 },
    ]);
  });

  it("reports unknown when no active-speaker sample falls within any of the speaker's turns", () => {
    const turns: SpeakerTurn[] = [{ speaker: 'Speaker A', start: 0, end: 10 }];
    const samples: ActiveSpeakerSample[] = [{ t: 50, activeTrackId: 4, confidence: 0.5 }];

    const result = associateSpeakersWithFaces(turns, samples);

    expect(result).toEqual([
      { speaker: 'Speaker A', faceTrackId: null, status: 'unknown', confidence: 0 },
    ]);
  });

  it('reports unknown when the best-matching track is below the confidence threshold', () => {
    const turns: SpeakerTurn[] = [{ speaker: 'Speaker A', start: 0, end: 10 }];
    const samples: ActiveSpeakerSample[] = [
      { t: 1, activeTrackId: 4, confidence: 0.5 },
      { t: 2, activeTrackId: null, confidence: null },
      { t: 3, activeTrackId: null, confidence: null },
    ];

    const result = associateSpeakersWithFaces(turns, samples);

    expect(result[0].status).toBe('unknown');
    expect(result[0].faceTrackId).toBeNull();
  });

  it('associates each distinct speaker independently', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 5 },
      { speaker: 'Speaker B', start: 5, end: 10 },
    ];
    const samples: ActiveSpeakerSample[] = [
      { t: 1, activeTrackId: 4, confidence: 0.5 },
      { t: 6, activeTrackId: 7, confidence: 0.5 },
    ];

    const result = associateSpeakersWithFaces(turns, samples);

    expect(result).toEqual([
      { speaker: 'Speaker A', faceTrackId: 4, status: 'matched', confidence: 1 },
      { speaker: 'Speaker B', faceTrackId: 7, status: 'matched', confidence: 1 },
    ]);
  });
});
