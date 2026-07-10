import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { DetectVoiceActivityDeps } from '@speedora/audio-intelligence';

const execFileAsync = promisify(execFile);

// Deployment-specific plumbing for @speedora/audio-intelligence's
// detectVoiceActivity(): which python executable to invoke, and where the
// script lives in this app's own directory/Docker layout - kept here, in
// apps/worker, rather than inside the stateless module itself, same
// reasoning as cameraMotionDeps.ts/facialIntelligenceDeps.ts. No model file
// to inject (webrtcvad ships its own bundled model data via pip, unlike
// MediaPipe-based detectors).
export const voiceActivityDeps: DetectVoiceActivityDeps = {
  execFile: execFileAsync,
  pythonPath: process.env.PYTHON_PATH ?? 'python3',
  scriptPath: path.join(__dirname, '../scripts/detect_voice_activity.py'),
};
