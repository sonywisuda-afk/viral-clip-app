# LLM — Clip Scoring & Content Intelligence

`packages/clip-scoring` — the one LLM call in the whole pipeline, run once per video inside the
`detect-clips` job over the full transcript. One `response_format` JSON-schema call produces
**everything** below at once (clip selection, virality score, hook/hashtags, the 9-dimension
`ClipScores` breakdown, and content classification) — deliberately not split into multiple LLM
calls, since the model already has to read the full transcript for any of these and a second call
would just double cost/latency for information already in context.

## What one call produces, per candidate clip

- **`startTime`/`endTime`** — snapped to real word boundaries afterward
  (`snapToWordBoundaries()`), since the LLM picks timestamps from text with timestamps rounded to
  0.1s in the prompt, not from the audio itself — a boundary can land mid-word without this pass.
- **`viralityScore`** (0–100) — the original single heuristic score, still used to initially rank/
  select candidates. Distinct from the Fusion Engine's `highlightScore` — see `ai/scoring.md` for
  how the two relate.
- **`hookText`** (~first 3 seconds suggested opening line) and **`hashtags`** (sanitized —
  `sanitizeHashtags()` strips a leading `#` and blank entries on every write path, both the LLM
  output and manual `PATCH` edits).
- **`ClipScores`** — 9 dimensions, each 0–100, clamped/sanitized (`clampScores()`) since structured
  output isn't a 100% guarantee the model stays in range:
  - `hookStrength`, `curiosity`, `emotion`, `storytelling` — grouped as **`engagement`**.
  - `educationalValue`, `practicalValue`, `novelty`, `trustAuthority` — grouped as **`knowledge`**.
  - `ctaStrength` — the sole **`conversion`** dimension.
  - `practicalValue` and `ctaStrength` were added later (on top of the original 7) as
    **independent LLM-scored metrics**, not derived from the other 7 — an explicit user choice
    over deriving "practical value" heuristically from e.g. educationalValue + storytelling.
    `practicalValue`'s prompt explicitly rewards concrete steps/instructions/checklists/directly-
    applicable answers, and penalizes pure opinion/motivation/theory/abstract framing with no
    actionable takeaway.
  - `reason` (1–2 sentences, the literal "explainable AI" deliverable — written for a human to
    read "why this clip", not an opaque number).
- **`topics`/`keywords`**, **`intent`** (a bounded free-string set:
  `educate/entertain/persuade/inspire/story/other` — not a Postgres enum, since it's LLM
  classification that might need a new value without a schema migration), **`ctaText`**.
- **Emoji suggestions** (`packages/emoji-suggester`) — a **separate, deterministic, non-LLM**
  module: 9 keyword-pattern rules (money, intensity, love, warning, percentage, funny, surprise,
  tips, question), capped at 5 per clip, run over the same transcript slice the candidate already
  used for scoring.

## Honesty about what these scores are

Every score above is an LLM heuristic read off the transcript — **not** a model trained/calibrated
on real engagement data, exactly like the Fusion Engine's own weights (see
`coding-standards.md`'s "scale honesty" principle). This is a deliberate choice against building
things like "Retention Prediction"/"Share Probability" as if they were trained predictions: there's
no engagement dataset in this project to train them from, and presenting an LLM guess as a trained
prediction would be misleading.

## Duration policy

`MAX_CLIP_SECONDS` (currently 600, raised from an original 90 after user feedback that a hard
90-second cap forced the LLM to cut off mid-story) is a prompt instruction, never validated/clamped
in code — the LLM is told to prefer a shorter, complete moment over truncating a longer one that
doesn't fit, not the other way around.

## Transcription provider (Groq vs. OpenAI Whisper)

Chosen **per video**, not per account (`apps/web`'s `EngineChoice` screen resets after every
upload cycle). Groq (`whisper-large-v3-turbo`, via its OpenAI-compatible endpoint) is the free
default and the only one required to boot (`GROQ_API_KEY`); OpenAI Whisper is a paid premium
option gated by a Midtrans-purchased `PremiumCredit` (see `backend.md`). Both go through the same
`openai` SDK, just pointed at different `baseURL`/`apiKey`.
