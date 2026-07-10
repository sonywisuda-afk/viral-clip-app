#!/usr/bin/env python3
"""
AI Fusion roadmap - OCR initiative, Batch OCR-1. Samples frames from a
clip's time range, runs Tesseract (via pytesseract) on each one, groups its
word-level output into LINE-level text blocks (Tesseract's own block_num/
par_num/line_num grouping - a whole subtitle line as one block, not one
entry per word), and prints a JSON array to stdout:

  [{
    "t": <seconds from clip start>,
    "textBlocks": [
      {
        "text": <string>,
        "boundingBox": {"xCenter", "yCenter", "width", "height"} (normalized),
        "confidence": <float, 0-1>
      }, ...
    ]
  }, ...]

textBlocks is an EMPTY array (not null) when no text was found in that
sampled frame - unlike every other detector in this pipeline (which report
at most one measurement per sample, null meaning "not found"), a frame can
legitimately contain MULTIPLE distinct text regions at once (a burned-in
subtitle AND a logo AND a price tag, all in the same frame), so this is an
array per sample rather than a single nullable value.

User's own staged roadmap for this initiative: OCR-1 (this script - raw
text+bbox+confidence only) -> OCR-2 (cross-frame text TRACKING to compute
duration/persistence, plus rule-based classification into 6 categories:
Subtitle/Slide/Caption/Logo/Price/Name - both done in TypeScript, see
@speedora/ocr-intelligence, NOT in this script) -> OCR-3 (object-detector
integration for a nearObject signal - deferred, no general object detector
exists anywhere in this codebase yet, explicit user decision to skip it
for now rather than add one just for this) -> OCR-4 (scene understanding
combining face+object+OCR). This script does ONLY the OCR-1 slice - no
tracking, no classification, no confidence-of-category anything.

OCR_MIN_CONFIDENCE below is a reasonable guess (not calibrated against
real footage) for filtering out Tesseract's own low-confidence noise
(misread individual characters on a busy/textured background) - same
"kejujuran skala" caveat as every other threshold in this pipeline.

PENDING REAL-MACHINE VERIFICATION: written in a sandbox with neither
Tesseract nor a real video file available, same honest gap as every other
subprocess-based script in this pipeline (detect_face_landmarks.py et al.)
- specifically unverified: (1) that pytesseract's image_to_data() output
shape/column names match this script's assumptions across Tesseract
versions; (2) that OCR_MIN_CONFIDENCE is a reasonable noise floor against
real burned-in-caption footage, not just synthetic test images.

Usage: detect_ocr_text.py <video_path> <start_seconds> <end_seconds> <interval_seconds> [tesseract_cmd]
"""
import json
import sys

import cv2
import pytesseract

# Reasonable guess, not calibrated against real footage - Tesseract's own
# per-word confidence (0-100 scale) below this is treated as noise and
# excluded from a line's averaged confidence; a line whose average ends up
# below this threshold (after excluding -1/"no confidence" words) is
# dropped entirely rather than reported as a low-quality read.
OCR_MIN_CONFIDENCE = 30

# Same 1 sample/sec convention as every other Python-subprocess sampler in
# this pipeline (detect_face_landmarks.py et al.) - OCR is comparatively
# expensive per-frame, but clips here are short (<=60s, see detect-clips'
# own upper bound), so this stays practical.
OCR_SAMPLE_INTERVAL_SECONDS = 1


def group_into_lines(data):
    """Groups pytesseract's word-level image_to_data() output (a dict of
    parallel lists) into line-level text blocks, keyed by Tesseract's own
    (block_num, par_num, line_num) tuple - preserves first-seen order
    (Tesseract already returns words in reading order), not sorted
    separately, so a multi-column layout doesn't get its lines interleaved."""
    lines = {}
    order = []
    n = len(data["text"])
    for i in range(n):
        word = data["text"][i].strip()
        if not word:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        if key not in lines:
            lines[key] = {"words": [], "confs": [], "lefts": [], "tops": [], "rights": [], "bottoms": []}
            order.append(key)
        conf = float(data["conf"][i])
        left = data["left"][i]
        top = data["top"][i]
        entry = lines[key]
        entry["words"].append(word)
        if conf >= 0:
            entry["confs"].append(conf)
        entry["lefts"].append(left)
        entry["tops"].append(top)
        entry["rights"].append(left + data["width"][i])
        entry["bottoms"].append(top + data["height"][i])
    return [lines[key] for key in order]


def text_blocks_from_frame(frame):
    frame_height, frame_width = frame.shape[:2]
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    data = pytesseract.image_to_data(frame_rgb, output_type=pytesseract.Output.DICT)

    blocks = []
    for line in group_into_lines(data):
        if not line["confs"]:
            continue
        average_confidence = sum(line["confs"]) / len(line["confs"])
        if average_confidence < OCR_MIN_CONFIDENCE:
            continue

        x0, y0 = min(line["lefts"]), min(line["tops"])
        x1, y1 = max(line["rights"]), max(line["bottoms"])
        blocks.append(
            {
                "text": " ".join(line["words"]),
                "boundingBox": {
                    "xCenter": ((x0 + x1) / 2) / frame_width,
                    "yCenter": ((y0 + y1) / 2) / frame_height,
                    "width": (x1 - x0) / frame_width,
                    "height": (y1 - y0) / frame_height,
                },
                "confidence": round(average_confidence / 100, 4),
            }
        )
    return blocks


def main() -> None:
    video_path = sys.argv[1]
    start = float(sys.argv[2])
    end = float(sys.argv[3])
    interval = float(sys.argv[4])
    # Optional - same "deployment config flows through deps + CLI args"
    # convention as every other script here (apps/worker's TESSERACT_PATH
    # env var, injected via ocrIntelligenceDeps.ts). Empty/absent means
    # pytesseract falls back to finding `tesseract` on PATH itself.
    tesseract_cmd = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] else None
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    results = []
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(json.dumps(results))
        return

    t = start
    while t < end:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if not ok:
            results.append({"t": round(t - start, 3), "textBlocks": []})
            t += interval
            continue

        try:
            text_blocks = text_blocks_from_frame(frame)
        except Exception:
            text_blocks = []

        results.append({"t": round(t - start, 3), "textBlocks": text_blocks})
        t += interval

    cap.release()
    print(json.dumps(results))


if __name__ == "__main__":
    main()
