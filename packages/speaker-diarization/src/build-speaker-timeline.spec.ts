import type { ActiveSpeakerSample, SpeakerFaceAssociation, SpeakerTurn } from '@speedora/contracts';
import { buildSpeakerTimeline, detectSpeakerTransitions } from './build-speaker-timeline';

describe('buildSpeakerTimeline', () => {
  const turns: SpeakerTurn[] = [
    { speaker: 'Speaker A', start: 0, end: 5 },
    { speaker: 'Speaker B', start: 5, end: 10 },
  ];

  it('attaches the matched faceTrackId and isActiveOnScreen=true when an active-speaker sample confirms it', () => {
    const associations: SpeakerFaceAssociation[] = [
      { speaker: 'Speaker A', faceTrackId: 4, status: 'matched', confidence: 0.9 },
    ];
    const samples: ActiveSpeakerSample[] = [{ t: 2, activeTrackId: 4, confidence: 0.5 }];

    const result = buildSpeakerTimeline(turns, associations, samples);

    expect(result[0]).toEqual({
      speaker: 'Speaker A',
      start: 0,
      end: 5,
      faceTrackId: 4,
      isActiveOnScreen: true,
    });
  });

  it('reports isActiveOnScreen=false when the matched face was never the active speaker during this turn', () => {
    const associations: SpeakerFaceAssociation[] = [
      { speaker: 'Speaker A', faceTrackId: 4, status: 'matched', confidence: 0.9 },
    ];
    const samples: ActiveSpeakerSample[] = [{ t: 2, activeTrackId: 9, confidence: 0.5 }];

    const result = buildSpeakerTimeline(turns, associations, samples);

    expect(result[0].isActiveOnScreen).toBe(false);
  });

  it('reports null faceTrackId/isActiveOnScreen when the speaker has no matched association at all', () => {
    const result = buildSpeakerTimeline(turns, [], []);

    expect(result[0]).toEqual({
      speaker: 'Speaker A',
      start: 0,
      end: 5,
      faceTrackId: null,
      isActiveOnScreen: null,
    });
  });

  it('reports null isActiveOnScreen (not false) when matched but no active-speaker samples fall within the turn', () => {
    const associations: SpeakerFaceAssociation[] = [
      { speaker: 'Speaker A', faceTrackId: 4, status: 'matched', confidence: 0.9 },
    ];

    const result = buildSpeakerTimeline(turns, associations, []);

    expect(result[0].faceTrackId).toBe(4);
    expect(result[0].isActiveOnScreen).toBeNull();
  });

  it('sorts unordered turns by start', () => {
    const unordered: SpeakerTurn[] = [
      { speaker: 'Speaker B', start: 5, end: 10 },
      { speaker: 'Speaker A', start: 0, end: 5 },
    ];

    const result = buildSpeakerTimeline(unordered, [], []);

    expect(result.map((entry) => entry.speaker)).toEqual(['Speaker A', 'Speaker B']);
  });
});

describe('detectSpeakerTransitions', () => {
  it('marks a transition at the start of each new speaker, with fromSpeaker=null for the first one', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 5 },
      { speaker: 'Speaker B', start: 5, end: 10 },
      { speaker: 'Speaker A', start: 10, end: 15 },
    ];

    const result = detectSpeakerTransitions(turns);

    expect(result.transitionCount).toBe(3);
    expect(result.transitions).toEqual([
      { t: 0, fromSpeaker: null, toSpeaker: 'Speaker A' },
      { t: 5, fromSpeaker: 'Speaker A', toSpeaker: 'Speaker B' },
      { t: 10, fromSpeaker: 'Speaker B', toSpeaker: 'Speaker A' },
    ]);
  });

  it('does not mark a transition between two consecutive turns from the same speaker', () => {
    const turns: SpeakerTurn[] = [
      { speaker: 'Speaker A', start: 0, end: 3 },
      { speaker: 'Speaker A', start: 3, end: 6 },
    ];

    expect(detectSpeakerTransitions(turns).transitionCount).toBe(1);
  });

  it('returns zero transitions for no turns at all', () => {
    expect(detectSpeakerTransitions([])).toEqual({ transitions: [], transitionCount: 0 });
  });
});
