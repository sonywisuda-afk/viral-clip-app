import {
  detectCameraMotionInputSchema,
  detectCameraMotionOutputSchema,
  type CameraMotionSample,
  type DetectCameraMotionInput,
} from '@speedora/contracts';
import type { ExecFileFn } from './detect-scene-cuts';

// Re-exported for convenience - callers importing detectCameraMotion from
// this module can also get its result type from the same import, same
// convention as @speedora/facial-intelligence's `export type {
// FacialEmotionSample }`. ExecFileFn itself is reused from detect-scene-
// cuts.ts (identical shape - a generic execFile-style function) rather than
// redefined - NOT re-exported again here (that would collide with
// detect-scene-cuts.ts's own export via index.ts's wildcard re-export);
// import it directly from './detect-scene-cuts' where needed, same as
// classify-scene-cut-types.ts does.
export type { CameraMotionSample };

// 1 sample/sec, same rationale and same value as @speedora/reframe's
// FACE_SAMPLE_INTERVAL_SECONDS / @speedora/facial-intelligence's
// FACIAL_EMOTION_SAMPLE_INTERVAL_SECONDS.
export const CAMERA_MOTION_SAMPLE_INTERVAL_SECONDS = 1;

export interface DetectCameraMotionDeps {
  execFile: ExecFileFn;
  // Same deployment-plumbing reasoning as @speedora/facial-intelligence's
  // DetectFacialEmotionDeps: which python executable to invoke and where
  // the script lives are apps/worker deployment concerns, not something
  // this stateless module should resolve itself via __dirname/process.env.
  // The adapter (apps/worker/src/cameraMotionDeps.ts) computes and injects
  // these.
  pythonPath: string;
  scriptPath: string;
}

// Batch SC-3 (Scene Intelligence taxonomy expansion, continuing SC-1/SC-2) -
// see this module's own contracts comment (packages/contracts/src/scene-
// intelligence.ts) for why OpenCV ECC alignment was chosen over ffmpeg's
// vidstabdetect.
//
// PENDING REAL-MACHINE VERIFICATION, same caveat as every other Python-
// subprocess module in this pipeline: this sandbox has no Python/OpenCV/
// video available, so the subprocess call itself and its JSON stdout shape
// are only exercised against a hand-written fixture string in this
// module's own test, not a real script run. See detect_camera_motion.py's
// own module comment for the specific cv2 API assumptions.
//
// Does NOT catch its own subprocess failures (unlike detectSceneCuts/
// classifySceneCutTypes/analyzeMotionEnergy, which are ffmpeg-based and DO
// catch internally) - propagates errors to the caller, same "module
// throws, adapter catches" pattern as detectFaces/detectFacialEmotion/
// detectGestures/detectFaceLandmarks.
export async function detectCameraMotion(
  input: DetectCameraMotionInput,
  deps: DetectCameraMotionDeps,
): Promise<CameraMotionSample[]> {
  const { sourcePath, startTime, endTime } = detectCameraMotionInputSchema.parse(input);

  const { stdout } = await deps.execFile(deps.pythonPath, [
    deps.scriptPath,
    sourcePath,
    startTime.toString(),
    endTime.toString(),
    CAMERA_MOTION_SAMPLE_INTERVAL_SECONDS.toString(),
  ]);

  return detectCameraMotionOutputSchema.parse(JSON.parse(stdout));
}
