#!/usr/bin/env python3
"""
Speaker Intelligence roadmap, Level 1 - Voice Activity Detection via
py-webrtcvad (WebRTC's classic GMM-based speech/non-speech classifier -
explicit user choice over Silero VAD specifically to avoid adding torch as a
dependency for this one detector, unlike diarize_speakers.py/
detect_vocal_emotion.py which already need it for other reasons).

Prints a JSON array of classified segments to stdout:

  [{"start": <seconds>, "end": <seconds>, "category": "speech"|"silence"|"non_speech",
    "confidence": null}, ...]

Times are seconds from the start of the given audio file, same convention as
diarize_speakers.py - the caller is responsible for mapping these onto
whatever timeline the audio file itself represents (currently: the whole
video, extracted once via ffmpeg.ts's extractAudio(), same
diarizeAudioPath as diarization/vocal-emotion - see transcribe.worker.ts).
`confidence` is always null: webrtcvad's is_speech() is a hard boolean
decision with no probability estimate to report - fabricating one would
violate this pipeline's "null, not an invented number" convention (see
packages/contracts/src/voice-activity.ts).

webrtcvad itself only ever distinguishes speech vs non-speech on raw PCM
frames - it has no notion of "silence" vs "noise" vs "music" vs "crowd" at
all. This script adds ONE cheap refinement on top of that binary decision:
a non-speech frame whose local RMS energy falls below
SILENCE_RMS_THRESHOLD is reported as "silence" (near-zero energy), anything
else non-speech is reported as generic "non_speech" - "noise"/"music"/
"crowd" remain unproduced/reserved (see voice-activity.ts's own comment); a
real audio-event classifier would be needed to tell those apart.

Audio is decoded via soundfile (not handed to webrtcvad as a file path -
webrtcvad only accepts raw PCM frames), same "avoid torchcodec's DLL
loading issues on this Windows Python 3.14 setup" reasoning as
diarize_speakers.py, even though webrtcvad itself has no torch dependency
at all. Resampled to 16kHz mono via scipy.signal.resample_poly (scipy is
already a dependency - see detect_face_landmarks.py's Hungarian-algorithm
use - so no new resampling library is added just for this).

Usage: detect_voice_activity.py <audio_path> <duration_seconds>

PENDING REAL-MACHINE VERIFICATION: this sandbox has no Python/webrtcvad/
soundfile/scipy available to run this against - only unit-tested (from the
TypeScript side, packages/audio-intelligence/src/detect-voice-activity.spec.ts)
against a hand-built fixture stdout string. Same caveat as every other
Python-subprocess module in this pipeline (see docs/testing.md).
"""
import json
import sys

import numpy as np
import soundfile as sf
import webrtcvad
from scipy.signal import resample_poly

SAMPLE_RATE = 16000  # webrtcvad only accepts 8000/16000/32000/48000 Hz
FRAME_MS = 30  # webrtcvad only accepts 10/20/30ms frames
FRAME_LEN = SAMPLE_RATE * FRAME_MS // 1000
# 0 (least aggressive) - 3 (most aggressive) filtering of non-speech -
# webrtcvad's own docs' typical middle-ground default, not calibrated by
# this project.
AGGRESSIVENESS = 2
# ~90ms - consecutive disagreeing frames required before flipping state,
# damps single-frame flicker in the raw per-frame decisions. A standard
# VAD smoothing technique (a "hangover" scheme), unvalidated threshold.
HANGOVER_FRAMES = 3
# int16 PCM RMS below this reads as near-zero energy ("true" silence)
# rather than merely non-speech audio (background noise, music, etc.) -
# unvalidated guess, same honesty as every other threshold in this
# pipeline.
SILENCE_RMS_THRESHOLD = 500.0


def load_mono_16k(path: str) -> np.ndarray:
    samples, sample_rate = sf.read(path, dtype="int16", always_2d=True)
    mono = samples.mean(axis=1).astype(np.int16)
    if sample_rate != SAMPLE_RATE:
        mono = resample_poly(mono, SAMPLE_RATE, sample_rate).astype(np.int16)
    return mono


def classify_frames(data: np.ndarray) -> list[tuple[float, bool, float]]:
    vad = webrtcvad.Vad(AGGRESSIVENESS)
    decisions = []
    frame_count = len(data) // FRAME_LEN
    for i in range(frame_count):
        start = i * FRAME_LEN
        frame = data[start : start + FRAME_LEN]
        t = start / SAMPLE_RATE
        is_speech = vad.is_speech(frame.tobytes(), SAMPLE_RATE)
        rms = float(np.sqrt(np.mean(frame.astype(np.float64) ** 2)))
        decisions.append((t, is_speech, rms))
    return decisions


def smooth(decisions: list[tuple[float, bool, float]]) -> list[tuple[float, bool, float]]:
    if not decisions:
        return []
    smoothed = []
    state = decisions[0][1]
    hangover = 0
    for t, is_speech, rms in decisions:
        if is_speech == state:
            hangover = 0
        else:
            hangover += 1
            if hangover >= HANGOVER_FRAMES:
                state = is_speech
                hangover = 0
        smoothed.append((t, state, rms))
    return smoothed


def category_for(is_speech: bool, rms: float) -> str:
    if is_speech:
        return "speech"
    return "silence" if rms < SILENCE_RMS_THRESHOLD else "non_speech"


def merge_segments(decisions: list[tuple[float, bool, float]], duration_seconds: float) -> list[dict]:
    if not decisions:
        return []
    segments = []
    cur_start = decisions[0][0]
    cur_category = category_for(decisions[0][1], decisions[0][2])
    for t, is_speech, rms in decisions[1:]:
        category = category_for(is_speech, rms)
        if category != cur_category:
            segments.append(
                {"start": round(cur_start, 3), "end": round(t, 3), "category": cur_category, "confidence": None}
            )
            cur_start = t
            cur_category = category
    segments.append(
        {
            "start": round(cur_start, 3),
            "end": round(duration_seconds, 3),
            "category": cur_category,
            "confidence": None,
        }
    )
    return segments


def main() -> None:
    audio_path = sys.argv[1]
    duration_seconds = float(sys.argv[2])

    data = load_mono_16k(audio_path)
    raw_decisions = classify_frames(data)
    smoothed = smooth(raw_decisions)
    segments = merge_segments(smoothed, duration_seconds)
    print(json.dumps(segments))


if __name__ == "__main__":
    main()
