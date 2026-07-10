import {
  detectVoiceActivityInputSchema,
  detectVoiceActivityOutputSchema,
  type DetectVoiceActivityInput,
  type VoiceActivitySegment,
} from '@speedora/contracts';
import type { ExecFileFn } from './loudness';

// ExecFileFn is reused from loudness.ts (identical shape - a generic
// execFile-style function) rather than redefined - NOT re-exported again
// here (that would collide with loudness.ts's own export via index.ts's
// wildcard re-export), same convention as @speedora/scene-intelligence's
// detect-camera-motion.ts reusing detect-scene-cuts.ts's ExecFileFn.
export interface DetectVoiceActivityDeps {
  execFile: ExecFileFn;
  // Same deployment-plumbing reasoning as @speedora/scene-intelligence's
  // DetectCameraMotionDeps: which python executable to invoke and where the
  // script lives are apps/worker deployment concerns, not something this
  // stateless module should resolve itself via __dirname/process.env. The
  // adapter (apps/worker/src/voiceActivityDeps.ts) computes and injects
  // these.
  pythonPath: string;
  scriptPath: string;
}

// Speaker Intelligence roadmap, Milestone A - py-webrtcvad-backed VAD (see
// apps/worker/scripts/detect_voice_activity.py's own module comment for why
// webrtcvad over Silero, and how silence/non_speech are distinguished).
// Runs ONCE PER VIDEO (not per-clip) - same scope as diarizeSpeakers, since
// voice activity is a whole-track timeline property, not something that
// depends on how a clip happens to be sliced.
//
// Does NOT catch its own subprocess failures - propagates to the caller,
// same "module throws, adapter catches" pattern as detectCameraMotion/
// detectFacialEmotion/detectGestures/detectFaceLandmarks (this project's
// Python-subprocess detectors, as opposed to the ffmpeg-only ones like
// detectSceneCuts which DO catch internally).
//
// PENDING REAL-MACHINE VERIFICATION: see detect_voice_activity.py's own
// module comment - this sandbox has no Python/webrtcvad available to run
// this against.
export async function detectVoiceActivity(
  input: DetectVoiceActivityInput,
  deps: DetectVoiceActivityDeps,
): Promise<VoiceActivitySegment[]> {
  const { audioPath, durationSeconds } = detectVoiceActivityInputSchema.parse(input);

  const { stdout } = await deps.execFile(deps.pythonPath, [
    deps.scriptPath,
    audioPath,
    durationSeconds.toString(),
  ]);

  return detectVoiceActivityOutputSchema.parse(JSON.parse(stdout));
}
