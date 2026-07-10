import { readFile } from 'node:fs/promises';
import { ocrLabeledTrackSchema } from '@speedora/contracts';
import { evaluateOcrClassification } from '@speedora/ocr-intelligence';

// OCR Batch OCR-2.5 (Calibration & Evaluation) - runnable entry point for
// @speedora/ocr-intelligence's evaluateOcrClassification(). This script has
// NO Prisma/BullMQ dependency at all (unlike reencode-existing-sources.ts in
// this same directory) - the evaluation function is pure, so this is just a
// JSON-file-in, report-out CLI.
//
// Input file format: a JSON array of { track: <one exported Clip.ocrTracks[]
// entry>, actualCategory: <human-assigned ground-truth label> }. There is no
// tool in this codebase that produces this file automatically - a human has
// to review a clip's exported ocrTracks (see Clip.ocrTracks in the API
// response) and assign actualCategory by eye. Building that annotation UI is
// explicitly out of scope for this batch (see CLAUDE.md's OCR-2.5 section) -
// this script exists so the measurement can be RUN the moment such a file
// exists, it does not produce one itself.
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: pnpm evaluate:ocr <path-to-labeled-tracks.json>');
    process.exitCode = 1;
    return;
  }

  const raw = JSON.parse(await readFile(filePath, 'utf-8'));
  const labeled = ocrLabeledTrackSchema.array().parse(raw);

  console.log(`Evaluating ${labeled.length} labeled OCR track(s)...`);
  const report = evaluateOcrClassification(labeled);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
