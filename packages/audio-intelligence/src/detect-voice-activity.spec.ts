import { detectVoiceActivity } from './detect-voice-activity';
import type { ExecFileFn } from './loudness';

function fakeDeps(execFile: ExecFileFn) {
  return { execFile, pythonPath: 'python3', scriptPath: '/scripts/detect_voice_activity.py' };
}

describe('detectVoiceActivity', () => {
  it('invokes the python script with audioPath and durationSeconds as args', async () => {
    const execFile = jest.fn().mockResolvedValue({ stdout: '[]', stderr: '' });

    await detectVoiceActivity(
      { audioPath: '/tmp/audio.wav', durationSeconds: 120 },
      fakeDeps(execFile),
    );

    expect(execFile).toHaveBeenCalledWith('python3', [
      '/scripts/detect_voice_activity.py',
      '/tmp/audio.wav',
      '120',
    ]);
  });

  it('parses the JSON array of classified segments from stdout', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { start: 0, end: 2, category: 'silence', confidence: null },
        { start: 2, end: 10, category: 'speech', confidence: null },
      ]),
      stderr: '',
    });

    const result = await detectVoiceActivity(
      { audioPath: '/tmp/audio.wav', durationSeconds: 10 },
      fakeDeps(execFile),
    );

    expect(result).toEqual([
      { start: 0, end: 2, category: 'silence', confidence: null },
      { start: 2, end: 10, category: 'speech', confidence: null },
    ]);
  });

  it('propagates a subprocess failure rather than swallowing it', async () => {
    const execFile = jest.fn().mockRejectedValue(new Error('python3 exited with code 1'));

    await expect(
      detectVoiceActivity({ audioPath: '/tmp/audio.wav', durationSeconds: 10 }, fakeDeps(execFile)),
    ).rejects.toThrow('python3 exited with code 1');
  });

  it('rejects a malformed input against the detectVoiceActivityInputSchema contract', async () => {
    const execFile = jest.fn();
    await expect(
      detectVoiceActivity({ audioPath: '/tmp/audio.wav' } as never, fakeDeps(execFile)),
    ).rejects.toThrow();
    expect(execFile).not.toHaveBeenCalled();
  });

  it('rejects stdout that fails the detectVoiceActivityOutputSchema contract', async () => {
    const execFile = jest.fn().mockResolvedValue({
      stdout: JSON.stringify([{ start: 0, end: 1, category: 'applause', confidence: null }]),
      stderr: '',
    });

    await expect(
      detectVoiceActivity({ audioPath: '/tmp/audio.wav', durationSeconds: 10 }, fakeDeps(execFile)),
    ).rejects.toThrow();
  });
});
