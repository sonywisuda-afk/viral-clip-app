# Scoring systems — how they relate

This codebase has **three** distinct numeric "how good is this clip" systems, built at different
times for different purposes. They are easy to conflate; this doc exists to disambiguate them. See
`ai/llm.md` and `ai/fusion.md` for full detail on each.

## 1. `Clip.viralityScore` — the original LLM selection score

Produced by `packages/clip-scoring`'s single LLM call (`ai/llm.md`), 0–100. This is the score used
to **select** which 1–3 candidate moments become clips in the first place — it exists before a
clip has even been rendered, let alone analyzed visually. A single heuristic number, no breakdown.

## 2. `ClipScores` — the 9-dimension LLM breakdown

Also from the same `clip-scoring` LLM call, stored in `Clip.scores`. Explains *why* a clip scored
the way it did across 9 named dimensions grouped into `engagement`/`knowledge`/`conversion`
domains (`SCORE_DOMAINS`, `ai/fusion.md`). This is "explainable AI" applied to the *selection*
score — it doesn't produce a new top-line number, it decomposes the reasoning behind
`viralityScore`.

`ClipScores` is also the one bridge between the LLM's read of the *transcript* and the Fusion
Engine's otherwise entirely audio/visual signal set — it's passed through the `render-clip` job
payload and consumed there as the Fusion Engine's `llm` signal (weight 5%, `ai/fusion.md`).

## 3. `Clip.highlightScore` — the Fusion Engine's multi-modal score

Produced by `packages/fusion-engine` **after** rendering, combining `audio`/`scene`/`facial`/`ocr`/
`llm` (and several weight-0 collected-but-uncalibrated signals) into one weighted score, with
`highlightConfidence`, `highlightBreakdown`/`highlightExplainability` (per-feature contributions,
not per-dimension like `ClipScores`), and `highlightPrediction`/`highlightRecommendation`. This is
the score meant to eventually inform *ranking/recommendation* across a video's already-selected
clips (`highlightRank`), not clip selection itself.

## Why three systems, not one

`viralityScore`/`ClipScores` exist because they're cheap (one LLM call, before any rendering work
happens) and are the only signal available at the moment clips are being *chosen* out of a full
transcript. `highlightScore` exists because, once a clip is actually rendered, far more signal is
available (real audio loudness, real scene cuts, real facial expression, real on-screen text) than
an LLM reading a transcript could ever infer — and unifying that into `ClipScores` retroactively
would mean re-running an LLM call after every render, for no clear benefit over a purpose-built
weighted-feature engine. Whether these should eventually be merged into one system (e.g. by having
the Fusion Engine directly gate which candidates get selected in the first place, rather than only
scoring what's already been selected) is an open architectural question — see `ai/fusion.md`'s note
on the spec's "analyze everything, then select" ordering vs. this codebase's "select first, then
analyze" ordering.
