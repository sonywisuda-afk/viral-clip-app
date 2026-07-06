import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { DetectFacesDeps } from '@speedora/reframe';

const execFileAsync = promisify(execFile);

// Deployment-specific plumbing for @speedora/reframe's detectFaces(): which
// python executable to invoke, and where the detection script + downloaded
// MediaPipe model file live in this app's own directory/Docker layout (see
// CLAUDE.md's Fase 2 section) - kept here, in apps/worker, rather than
// inside the stateless module itself, which should never need to know
// about apps/worker's specific file layout. Lives at this same directory
// depth apps/worker/src/faceDetection.ts used to (pre-migration) so
// __dirname still resolves scripts/models the same way.
export const faceDetectionDeps: DetectFacesDeps = {
  execFile: execFileAsync,
  pythonPath: process.env.PYTHON_PATH ?? 'python3',
  scriptPath: path.join(__dirname, '../scripts/detect_faces.py'),
  modelPath:
    process.env.FACE_DETECTOR_MODEL_PATH ??
    path.join(__dirname, '../models/blaze_face_short_range.tflite'),
};
