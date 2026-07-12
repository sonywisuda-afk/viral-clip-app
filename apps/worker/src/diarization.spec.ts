const execFileMock = jest.fn(
  (
    _file: string,
    _args: string[],
    _options: unknown,
    callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
  ) => {
    callback(null, { stdout: '[]', stderr: '' });
  },
);

jest.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => (execFileMock as unknown as (...a: unknown[]) => void)(...args),
}));

import { assignSpeakerLabels, diarizeSpeakers, toFriendlySpeakerTurns } from './diarization';

describe('diarizeSpeakers', () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it('shells out to python3 with the audio path only (no token in argv)', async () => {
    await diarizeSpeakers('/tmp/audio.mp3');

    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [file, args] = execFileMock.mock.calls[0];
    expect(file).toBe('python3');
    expect(args).toEqual(expect.arrayContaining(['/tmp/audio.mp3']));
    expect(args[0]).toContain('diarize_speakers.py');
    expect(args).toHaveLength(2);
  });

  it('passes a timeout so a hung pyannote inference cannot block the job forever', async () => {
    await diarizeSpeakers('/tmp/audio.mp3');

    const [, , options] = execFileMock.mock.calls[0];
    expect((options as { timeout: number }).timeout).toBeGreaterThan(0);
  });

  it('parses the JSON array of speaker turns from stdout', async () => {
    execFileMock.mockImplementationOnce((_file, _args, _options, callback) => {
      callback(null, {
        stdout: JSON.stringify([
          { start: 0, end: 5.2, speaker: 'SPEAKER_00' },
          { start: 5.2, end: 9.8, speaker: 'SPEAKER_01' },
        ]),
        stderr: '',
      });
    });

    const result = await diarizeSpeakers('/tmp/audio.mp3');

    expect(result).toEqual([
      { start: 0, end: 5.2, speaker: 'SPEAKER_00' },
      { start: 5.2, end: 9.8, speaker: 'SPEAKER_01' },
    ]);
  });

  it('propagates the error when the python subprocess fails (missing token, gated model not accepted, etc.)', async () => {
    execFileMock.mockImplementationOnce((_file, _args, _options, callback) => {
      callback(new Error('python3 exited with code 1'), { stdout: '', stderr: 'boom' });
    });

    await expect(diarizeSpeakers('/tmp/audio.mp3')).rejects.toThrow('python3 exited with code 1');
  });

  it('propagates a timeout as an ordinary rejection (the same "skip speaker labels" path as any other diarization failure)', async () => {
    execFileMock.mockImplementationOnce((_file, _args, _options, callback) => {
      callback(Object.assign(new Error('python3 ETIMEDOUT'), { killed: true, signal: 'SIGTERM' }), {
        stdout: '',
        stderr: '',
      });
    });

    await expect(diarizeSpeakers('/tmp/audio.mp3')).rejects.toThrow('ETIMEDOUT');
  });
});

describe('assignSpeakerLabels', () => {
  it('assigns friendly "Speaker A"/"Speaker B" labels in order of first appearance', () => {
    const segments = [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 6 },
    ];
    const turns = [
      { start: 0, end: 2, speaker: 'SPEAKER_01' },
      { start: 2, end: 4, speaker: 'SPEAKER_00' },
      { start: 4, end: 6, speaker: 'SPEAKER_01' },
    ];

    // SPEAKER_01 talks first (segment 0) -> "Speaker A"; SPEAKER_00 is the
    // second distinct raw ID encountered -> "Speaker B" - not alphabetical
    // by raw ID, order of first appearance in the segments themselves.
    expect(assignSpeakerLabels(segments, turns)).toEqual(['Speaker A', 'Speaker B', 'Speaker A']);
  });

  it('picks the turn with the largest overlap when a segment straddles a speaker change', () => {
    const segments = [{ start: 0, end: 10 }];
    const turns = [
      { start: 0, end: 3, speaker: 'SPEAKER_00' }, // 3s overlap
      { start: 3, end: 10, speaker: 'SPEAKER_01' }, // 7s overlap - wins
    ];

    // SPEAKER_01 wins the overlap and, being the only speaker assigned in
    // this test, becomes "Speaker A" (first label handed out) - the
    // assertion that matters here is WHICH raw speaker wins, not the label.
    expect(assignSpeakerLabels(segments, turns)).toEqual(['Speaker A']);
  });

  it('leaves a segment unassigned when no turn overlaps it at all', () => {
    const segments = [{ start: 100, end: 105 }];
    const turns = [{ start: 0, end: 10, speaker: 'SPEAKER_00' }];

    expect(assignSpeakerLabels(segments, turns)).toEqual([undefined]);
  });

  it('leaves every segment unassigned when diarization found no turns at all', () => {
    const segments = [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ];

    expect(assignSpeakerLabels(segments, [])).toEqual([undefined, undefined]);
  });
});

describe('toFriendlySpeakerTurns', () => {
  it('relabels raw turns with the SAME friendly labels assignSpeakerLabels would assign', () => {
    const segments = [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 6 },
    ];
    const turns = [
      { start: 0, end: 2, speaker: 'SPEAKER_01' },
      { start: 2, end: 4, speaker: 'SPEAKER_00' },
      { start: 4, end: 6, speaker: 'SPEAKER_01' },
    ];

    expect(toFriendlySpeakerTurns(segments, turns)).toEqual([
      { start: 0, end: 2, speaker: 'Speaker A' },
      { start: 2, end: 4, speaker: 'Speaker B' },
      { start: 4, end: 6, speaker: 'Speaker A' },
    ]);
  });

  it('drops a raw turn that no segment ever picked as its best-overlap speaker', () => {
    // SPEAKER_00 briefly overlaps the segment but loses to SPEAKER_01's
    // larger overlap - assignSpeakerLabels never surfaces SPEAKER_00 at
    // all, so toFriendlySpeakerTurns must not invent a label for its turn
    // either (nothing in the persisted transcript would ever show it).
    const segments = [{ start: 0, end: 10 }];
    const turns = [
      { start: 0, end: 3, speaker: 'SPEAKER_00' },
      { start: 3, end: 10, speaker: 'SPEAKER_01' },
    ];

    expect(toFriendlySpeakerTurns(segments, turns)).toEqual([
      { start: 3, end: 10, speaker: 'Speaker A' },
    ]);
  });

  it('returns an empty array when diarization found no turns at all', () => {
    expect(toFriendlySpeakerTurns([{ start: 0, end: 5 }], [])).toEqual([]);
  });
});
