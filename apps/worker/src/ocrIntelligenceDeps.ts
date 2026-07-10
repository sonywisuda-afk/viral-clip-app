import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { DetectOcrTextDeps } from '@speedora/ocr-intelligence';

const execFileAsync = promisify(execFile);

// Deployment-specific plumbing for @speedora/ocr-intelligence's
// detectOcrText() - same reasoning as facialIntelligenceDeps.ts/
// faceDetectionDeps.ts. Unlike those, there's no MediaPipe model FILE to
// locate here - TESSERACT_PATH (default empty string) only matters when
// the `tesseract` binary isn't already on PATH, in which case pytesseract
// needs to be told exactly where it is.
export const ocrIntelligenceDeps: DetectOcrTextDeps = {
  execFile: execFileAsync,
  pythonPath: process.env.PYTHON_PATH ?? 'python3',
  scriptPath: path.join(__dirname, '../scripts/detect_ocr_text.py'),
  tesseractPath: process.env.TESSERACT_PATH ?? '',
};
