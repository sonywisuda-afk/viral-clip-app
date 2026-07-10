# Audio Intelligence

Everything derived from the audio track: raw acoustic features, speaker diarization, and vocal
(tone-based, not word-based) emotion. All three reuse the **same** full-track audio extraction
(`diarizeAudioPath`, extracted once per `transcribe` job) rather than each doing their own ffmpeg
extraction.

## Audio Intelligence (`packages/audio-intelligence`)

Per-`TranscriptSegment` loudness/rate features, computed in `transcribe.worker.ts` after Whisper
returns:

- **Loudness/RMS/peak** — one ffmpeg `astats` subprocess call per segment (`-ss`/`-to` slice),
  "last match wins" stderr parsing (correct for both mono and multi-channel, which always ends
  with an "Overall" section). `TranscriptSegment.rmsDb`/`peakDb`, `null` on a per-segment failure
  (isolated — one bad segment doesn't stop the others).
  - dB values are **absolute**, not normalized relative to the rest of the same video — a known,
    documented simplification (see `ai/fusion.md`'s audio-signal normalization note).
- **Speaking rate** — `computeSpeakingRate()`, pure word-count ÷ segment-duration math, no
  subprocess at all.
- **Pitch/F0** — not implemented. Would need Python + librosa; ffmpeg has no built-in pitch-
  tracking filter. Explicitly still on the roadmap (the user's own reference diagram names
  Librosa/pitch/energy), deferred pending a verifiable Python environment, not abandoned.

## Speaker Diarization (`apps/worker/scripts/diarize_speakers.py`)

`pyannote/speaker-diarization-community-1` (the *community-1* checkpoint specifically — the more
commonly documented `speaker-diarization-3.1` checkpoint silently mixes segmentation/embedding
from -3.1 with clustering defaults hardcoded to community-1 in this project's installed
`pyannote.audio` 4.x, discovered only by running it, not from docs). Runs **once per video** (not
per-clip like face detection) — speaker turn-taking needs full-video context and doesn't depend on
how Whisper happened to chunk its own transcription. Requires a gated Hugging Face model +
`HUGGINGFACE_TOKEN` (read directly from the environment, never a CLI arg). Diarization failure
never fails the `transcribe` job — segments just keep `speaker: undefined`.

`assignSpeakerLabels()` maps each Whisper segment to the pyannote turn with the largest time
overlap (not per-word — Whisper segment boundaries rarely land exactly on a speaker change). Raw
pyannote labels (`SPEAKER_00`) are translated to "Speaker A"/"Speaker B" by first-appearance order
before storage — the raw labels aren't stable/comparable across videos and mean nothing to an end
user.

Audio is decoded via `soundfile` and handed to the pipeline as a raw waveform dict, not a file
path — `pyannote`'s default file-path route depends on `torchcodec`, whose native DLLs don't load
in this project's dev environment. `torchcodec` itself was later fully uninstalled once this
`soundfile`-based route was confirmed to be the only one actually exercised — it was only ever a
transitive dependency of `torchaudio` that this code never needed.

## Vocal Emotion Detection (`apps/worker/scripts/detect_vocal_emotion.py`)

`superb/wav2vec2-base-superb-er` (4-class IEMOCAP taxonomy: neutral/happy/angry/sad) via
`transformers`'s `audio-classification` pipeline — a public, **non-gated** model, no
`HUGGINGFACE_TOKEN` needed for this one. Runs **per-segment** (unlike diarization) — vocal tone is
a moment-to-moment signal, not something needing cross-segment identity consistency. Reuses the
same full-track audio as diarization, sliced per segment; segments under 0.5s are skipped
(`null`, not classified) as too short for a meaningful reading.

**Explicitly flagged limitation**: the model is trained on *acted* speech (professional actors
reading scripted emotional lines), a materially different distribution from this app's real
talking-head/interview footage — results are a noisy complementary signal, never the sole basis
for a decision, same caveat as every ML classifier in this pipeline (see `coding-standards.md`).

Not fed into `ClipScores`/the Fusion Engine as of this writing — purely informational/display
(Timeline Editor emoji tags), same status as `speaker`.

## Deferred

Pitch/F0 tracking via Librosa — see above.
