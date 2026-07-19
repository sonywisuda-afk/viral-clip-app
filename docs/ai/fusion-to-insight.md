# Fusion Engine → Explainability → Analytics → Insight → Prediction

Sprint 6 (Analytics Dashboard, 6A-6K) did **not** change `packages/fusion-engine` — see
`ai/fusion.md` for that pipeline, unchanged. What Sprint 6 added sits entirely *downstream* of it:
a layer that reads the Fusion Engine's frozen output and real post-publish engagement data, and
produces new numbers/text from them. This doc exists because that downstream layer introduces a
second, easily-confused "prediction" concept (and a third one already existed, paused) — the goal
here is a single place that says which box is model output and which is analytics interpretation.
See `ai/scoring.md` for a related but different disambiguation (`viralityScore`/`ClipScores`/
`highlightScore` — three *selection/scoring* systems); this doc is about what happens to
`highlightScore` *after* it's computed, not about that axis.

## The flow

```
                          ┌─────────────────────────────────────────┐
                          │  MODEL / FUSION ENGINE OUTPUT            │
                          │  computed once, at render time,          │
                          │  frozen on Clip, never recomputed on     │
                          │  read                                    │
                          └─────────────────────────────────────────┘
1. Fusion Engine            packages/fusion-engine, render-clip.worker.ts (docs/ai/fusion.md)
   highlightScore /         Weighted multi-modal score over audio/scene/facial/ocr/llm signals.
   highlightConfidence
        │
        ▼
2. Explainability            Same package, same call, part of the same frozen output.
   highlightBreakdown /      topFactors ranked by weightedContribution; highlightPrediction is
   highlightExplainability / predictPerformance()'s deterministic bucket (uncertain/
   highlightPrediction /     likely_high_performer/likely_low_performer) - a heuristic threshold
   highlightRecommendation   read of THIS clip's own score+confidence, no historical data, no
                              regression. All of this is written to Clip.* columns once and read
                              back verbatim by GET /clips/:id/explainability (Milestone 4).
                          ┌─────────────────────────────────────────┐
                          │  ANALYTICS INTERPRETATION                │
                          │  computed on read, from real engagement  │
                          │  data + the frozen output above;         │
                          │  changes as more data accumulates;       │
                          │  NEVER written back to Clip               │
                          └─────────────────────────────────────────┘
3. Analytics                 packages/analytics-report (fusion-signal-analytics.util.ts)
   (aggregation)             Aggregates step 1/2's output ACROSS MANY clips - e.g.
                              computeSignalContributions() answers "what's actually moving
                              highlightScore across this window's clips," not anything about one
                              clip. Same functions serve owner-scoped AnalyticsModule and
                              system-wide OpsAiModule (docs/backend.md) - pooling differs, the
                              aggregation math doesn't.
        │
        ▼
4. Insight                   packages/analytics-report (clip-narrative.util.ts, Sprint 6I)
   (narrative)                generateClipNarrative() - a RULES-BASED narrative, not a new
                              inference: compares this clip's real engagementScore (from
                              PublishRecordStatsSnapshot) against the median of this creator's
                              OTHER published clips, and explains the gap using step 2's
                              topFactors/breakdown. No LLM call, no new model. classification is
                              one of over_performed/under_performed/as_expected/not_enough_data.
        │
        ▼
5. Prediction                 packages/analytics-report (prediction.util.ts, Sprint 6J)
   (statistical projection)   predictEngagement() - a CLOSED-FORM LINEAR REGRESSION (least-
                              squares, via packages/dataset-quality's pearsonCorrelation), fit
                              per-owner over that creator's OTHER (highlightScore, engagementScore)
                              pairs. Takes step 1's highlightScore as an input, produces a
                              predictedEngagementScore - a different number for a different
                              question ("given this score, what real engagement do we expect for
                              THIS creator specifically") than anything in steps 1-4.
```

Steps 4 and 5 are composed together into one API field, `ClipPerformanceDto.insight`
(`apps/api/src/clips/clip-performance.util.ts:135-140`) — `{ ...narrative, prediction }`. They are
still two separate function calls with two separate concerns (narrative text vs. a numeric
projection), deliberately kept as two functions rather than one
(`clip-narrative.util.ts`'s own doc comment: "Sprint 6J's `predictEngagement()` is a deliberately
separate function ... this returns everything on `ClipInsightSection` except `prediction` — the
caller composes the two together").

## Why three things are called "prediction" in this codebase, and which is which

| # | Name | Where | What it is | Input | Recalculated? |
|---|---|---|---|---|---|
| 1 | `highlightPrediction` | `packages/fusion-engine/src/predict.ts` | Deterministic bucket from a fixed threshold table (`confidence < 0.4` → `uncertain`, score ≥ 65 → `likely_high_performer`, etc.) | This clip's own `highlightScore`+`confidence` only | No — frozen on `Clip` at render time |
| 2 | `ClipPerformanceDto.insight.prediction` | `packages/analytics-report/src/aggregation/prediction.util.ts` (Sprint 6J) | Closed-form least-squares linear regression, gated on `MIN_SAMPLES_FOR_CORRELATION` | This clip's `highlightScore` + this owner's OTHER clips' real (score, engagement) history | Yes — every read, as more history accumulates |
| 3 | Fusion Engine v3 (`packages/fusion-ml`) | `docs/ai/fusion-v3.md` | Real gradient-descent trained model, `FUSION_ENGINE_V3_ENABLED` flag OFF | A full production dataset (0 usable samples today) | N/A — not live, zero call sites in `apps/worker`/`apps/api` |

None of these three are the same thing, and none of them call each other. #1 is part of the
**model's own output** — it never leaves `packages/fusion-engine`'s pure, synchronous, no-DB
boundary (`docs/ai/fusion.md`'s module-pattern note) except to be stored verbatim. #2 is an
**analytics-layer statistic** computed entirely in `apps/api`/`packages/analytics-report`, using #1's
score only as one input alongside real engagement outcomes it has no part in producing. #3 is a
**not-yet-live replacement candidate** for #1 — when/if it ships, it would produce a new
`highlightScore`, not touch #2's regression at all, since #2 is defined generically in terms of
"whatever `highlightScore` currently is."

## The one hard rule that keeps this from becoming circular

`Clip.highlightScore`/`highlightBreakdown`/`highlightExplainability`/`highlightPrediction`/
`highlightRecommendation` are **write-once, read-many**: set by `render-clip.worker.ts`, never
updated by anything in `apps/api`. Every step downstream of the model/Fusion-Engine line above
(Analytics, Insight, Prediction) only ever *reads* those columns — none of them write back to
`Clip`. This is why `GET /clips/:id/explainability`'s output can never drift from what
`ClipPerformanceDto.score` reports for the same clip
(`clip-performance.util.ts`'s own comment: "`score` reuses `getExplainability`'s own mapping calls
so this section can never drift"), and why re-running Insight/Prediction against a clip whose
engagement data has changed since yesterday is safe — it can change *its own* output, but it can
never retroactively change what the model originally said.

## Open question this doc does not resolve

Whether Analytics/Insight/Prediction (Sprint 6) and Fusion Engine v3 (`fusion-ml`) should ever
converge — e.g. a future trained model that consumes real engagement outcomes the way #2's
regression does today, but as a proper feature in a trained model rather than a closed-form fit —
is exactly the kind of question `docs/ai/fusion-v3.md`'s M2C (Baseline ML Training) milestone would
eventually answer, once production has enough samples. Nothing in Sprint 6 assumes an answer either
way; #2 was built as a lightweight, honest heuristic specifically because M2C is gated on data that
doesn't exist yet, not as a permanent substitute for it.
