import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { DetectCameraMotionDeps } from '@speedora/scene-intelligence';

const execFileAsync = promisify(execFile);

// Deployment-specific plumbing for @speedora/scene-intelligence's
// detectCameraMotion(): which python executable to invoke, and where the
// script lives in this app's own directory/Docker layout (see CLAUDE.md's
// Batch SC-3 section) - kept here, in apps/worker, rather than inside the
// stateless module itself, same reasoning as facialIntelligenceDeps.ts/
// faceDetectionDeps.ts. No model file to inject (OpenCV's ECC alignment
// needs no trained model, unlike MediaPipe-based detectors).
export const cameraMotionDeps: DetectCameraMotionDeps = {
  execFile: execFileAsync,
  pythonPath: process.env.PYTHON_PATH ?? 'python3',
  scriptPath: path.join(__dirname, '../scripts/detect_camera_motion.py'),
};
