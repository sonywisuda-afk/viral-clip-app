import {
  detectFaceLandmarksInputSchema,
  detectFaceLandmarksOutputSchema,
  type DetectFaceLandmarksInput,
  type FaceLandmarkSample,
} from '@speedora/contracts';
import type { ExecFileFn } from './detect-facial-emotion';

export type { FaceLandmarkSample };

// 1 sample/sec, same rationale/value as FACIAL_EMOTION_SAMPLE_INTERVAL_SECONDS
// and @speedora/reframe's FACE_SAMPLE_INTERVAL_SECONDS.
export const FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS = 1;

export interface DetectFaceLandmarksDeps {
  execFile: ExecFileFn;
  pythonPath: string;
  scriptPath: string;
  // FaceLandmarker's OWN `.task` model bundle - NOT the same file as face
  // detection's blaze_face_short_range.tflite (see the script's own module
  // comment) - a separate deployment asset apps/worker must download.
  modelPath: string;
}

// PENDING REAL-MACHINE VERIFICATION - see detect_face_landmarks.py's own
// module comment for the specific gaps (Euler convention, landmark index
// assumptions). Same "sandbox has neither Python nor a real video"
// limitation as detectFacialEmotion/detectGestures.
export async function detectFaceLandmarks(
  input: DetectFaceLandmarksInput,
  deps: DetectFaceLandmarksDeps,
): Promise<FaceLandmarkSample[]> {
  const { sourcePath, startTime, endTime } = detectFaceLandmarksInputSchema.parse(input);

  const { stdout } = await deps.execFile(deps.pythonPath, [
    deps.scriptPath,
    sourcePath,
    startTime.toString(),
    endTime.toString(),
    FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS.toString(),
    deps.modelPath,
  ]);

  return detectFaceLandmarksOutputSchema.parse(JSON.parse(stdout));
}
