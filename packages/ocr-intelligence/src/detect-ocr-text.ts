import {
  detectOcrTextInputSchema,
  detectOcrTextOutputSchema,
  type DetectOcrTextInput,
  type OcrSample,
} from '@speedora/contracts';

export type { OcrSample };

// Same 1 sample/sec convention as every other Python-subprocess sampler in
// this pipeline (FACE_LANDMARK_SAMPLE_INTERVAL_SECONDS et al.) - see the
// script's own module comment for why this stays practical despite OCR's
// higher per-frame cost.
export const OCR_SAMPLE_INTERVAL_SECONDS = 1;

export type ExecFileFn = (
  file: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export interface DetectOcrTextDeps {
  execFile: ExecFileFn;
  // Same deployment-plumbing reasoning as every other *Deps interface in
  // this pipeline - which python executable to invoke and where the script
  // lives are apps/worker deployment concerns, not something this
  // stateless module should resolve itself.
  pythonPath: string;
  scriptPath: string;
  // Unlike MediaPipe's *Deps.modelPath, Tesseract has no separate model
  // FILE to inject here - `tesseractPath` is the tesseract BINARY's path
  // (TESSERACT_PATH env var), only needed when it isn't already on PATH.
  // Empty string means "let pytesseract find it on PATH itself".
  tesseractPath: string;
}

// PENDING REAL-MACHINE VERIFICATION - see detect_ocr_text.py's own module
// comment for the specific gaps (pytesseract output shape across versions,
// OCR_MIN_CONFIDENCE's noise floor). Same "sandbox has neither the OCR
// binary nor a real video" limitation as detectFaceLandmarks/
// detectFacialEmotion/detectGestures.
export async function detectOcrText(
  input: DetectOcrTextInput,
  deps: DetectOcrTextDeps,
): Promise<OcrSample[]> {
  const { sourcePath, startTime, endTime } = detectOcrTextInputSchema.parse(input);

  const { stdout } = await deps.execFile(deps.pythonPath, [
    deps.scriptPath,
    sourcePath,
    startTime.toString(),
    endTime.toString(),
    OCR_SAMPLE_INTERVAL_SECONDS.toString(),
    deps.tesseractPath,
  ]);

  return detectOcrTextOutputSchema.parse(JSON.parse(stdout));
}
