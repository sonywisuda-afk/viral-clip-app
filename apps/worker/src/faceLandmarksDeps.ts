import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { DetectFaceLandmarksDeps } from '@speedora/facial-intelligence';
import { limitExecFile } from './subprocessLimiter';

const execFileAsync = limitExecFile(promisify(execFile));

// Deployment-specific plumbing for @speedora/facial-intelligence's
// detectFaceLandmarks() - same "deployment config lives here, not inside
// the stateless module" reasoning as facialIntelligenceDeps.ts/
// faceDetectionDeps.ts. Uses its OWN model file/env var
// (FACE_LANDMARKER_MODEL_PATH) - FaceLandmarker needs its own `.task`
// bundle, NOT the blaze_face_short_range.tflite file face detection/
// facial emotion already download (see detect_face_landmarks.py's module
// comment).
export const faceLandmarksDeps: DetectFaceLandmarksDeps = {
  execFile: execFileAsync,
  pythonPath: process.env.PYTHON_PATH ?? 'python3',
  scriptPath: path.join(__dirname, '../scripts/detect_face_landmarks.py'),
  modelPath:
    process.env.FACE_LANDMARKER_MODEL_PATH ?? path.join(__dirname, '../models/face_landmarker.task'),
};
