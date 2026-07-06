import {
  detectFacesInputSchema,
  detectFacesOutputSchema,
  type DetectFacesInput,
  type FaceSample,
} from '@speedora/contracts';

// Re-exported for convenience - callers importing detectFaces from this
// module can also get its result type from the same import, same
// convention as @speedora/cutlist's `export type { CutRange }`.
export type { FaceSample };

// 1 sample/sec keeps a 60s clip (detect-clips' own upper bound) to at most
// 60 MediaPipe calls - plenty for normal head movement, and cheap next to
// the transcribe/render steps already in the pipeline. See CLAUDE.md's
// Fase 2 sampling decision.
export const FACE_SAMPLE_INTERVAL_SECONDS = 1;

export type ExecFileFn = (
  file: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export interface DetectFacesDeps {
  execFile: ExecFileFn;
  // Which python executable to invoke, and where the detection script +
  // downloaded MediaPipe model file live - all three are apps/worker
  // deployment concerns (Docker image layout, PYTHON_PATH env var, model
  // download location), not something this stateless module should resolve
  // itself via __dirname (which would break once this code lives in
  // packages/reframe/dist rather than apps/worker/dist). The adapter
  // (apps/worker/src/faceDetectionDeps.ts) computes and injects these.
  pythonPath: string;
  scriptPath: string;
  modelPath: string;
}

// Shells out to deps.scriptPath exactly like ffmpeg.ts shells out to the
// ffmpeg binary - MediaPipe's own Node.js story is WASM/browser oriented,
// not first-class server-side, while the real `mediapipe` PyPI package is
// mature and well-supported. input.sourcePath must be a local file (same
// constraint as ffmpeg - no seeking directly against object storage).
export async function detectFaces(
  input: DetectFacesInput,
  deps: DetectFacesDeps,
): Promise<FaceSample[]> {
  const { sourcePath, startTime, endTime } = detectFacesInputSchema.parse(input);

  const { stdout } = await deps.execFile(deps.pythonPath, [
    deps.scriptPath,
    sourcePath,
    startTime.toString(),
    endTime.toString(),
    FACE_SAMPLE_INTERVAL_SECONDS.toString(),
    deps.modelPath,
  ]);

  return detectFacesOutputSchema.parse(JSON.parse(stdout));
}
