# CLAUDE.md

Architecture & convention reference for **Speedora** — an AI video repurposing platform (OpusClip-
style) that turns long videos into short, viral-ready clips automatically.

This file is an **index**. Detailed, current-state documentation lives in [`docs/`](docs/);
this file stays short on purpose so it's cheap to load every session. Historical "how we got
here" narrative for each shipped feature has been distributed into the topic docs below (as
durable facts, not a session-by-session changelog) — check `git log`/PR history if you need the
literal chronology.

## Product summary

Core MVP flow:

```
Upload video → Transcript (ASR) → Auto-clip detection → Caption + Reframe render → Download
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| Backend API | NestJS |
| Database | PostgreSQL via Prisma (`packages/database`) |
| Queue / Cache | Redis + BullMQ |
| Video processing | FFmpeg (separate worker nodes) |
| ASR | Whisper — Groq `whisper-large-v3-turbo` (default, free) or OpenAI `whisper-1` (paid premium) |
| Object storage | S3-compatible — MinIO in dev, Cloudflare R2 in production |

## Monorepo layout

```
apps/
  web/        # Next.js frontend
  api/        # NestJS backend
  worker/     # BullMQ job consumer — ASR, clip detection, FFmpeg render, AI analysis
packages/
  shared/, database/, storage/, social/, contracts/    # cross-cutting infrastructure
  clip-scoring/, cutlist/, subtitles/, reframe/, emoji-suggester/,
  audio-intelligence/, scene-intelligence/, facial-intelligence/,
  gesture-intelligence/, ocr-intelligence/, object-intelligence/, editing-rhythm/,
  primary-subject/, composition-intelligence/,
  fusion-engine/,                                      # stateless JSON-in/JSON-out AI modules
  fusion-ml/,                                           # Fusion Engine v3 (M2A-B) - contracts,
                                                         # interfaces, a real (if simple) baseline
                                                         # model, no caller in apps/worker/api yet
                                                         # (see ai/fusion-v3.md)
  dataset-quality/                                      # M1.5's missing-data/distribution/drift/
                                                         # calibration + M1's correlation math -
                                                         # shared by apps/worker's CLI report and
                                                         # apps/api's GET /ops/ai/* (M5C-B)
```

`apps/web` and `apps/api` only communicate over HTTP. `apps/worker` has no HTTP server — it only
consumes BullMQ jobs. Every AI analysis capability is a small, independently-testable stateless
package following one architectural pattern — see [`ARCHITECTURE.md`](ARCHITECTURE.md) for the
pattern itself and its "add a new module" checklist.

## Documentation index

| Doc | Covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Full pipeline, state machine, job design, storage, auth, the JSON-contract pattern, AI signal flow |
| [`docs/coding-standards.md`](docs/coding-standards.md) | Conventions: module checklist, extraction discipline, "scale honesty", data-shape conventions, the recurring TS2742 pitfall |
| [`docs/backend.md`](docs/backend.md) | `apps/api` — auth, endpoints, Publish Center (YouTube/TikTok/Instagram), payments |
| [`docs/frontend.md`](docs/frontend.md) | `apps/web` — routes, Timeline Editor, Dashboard, OCR Review UI, processing UX |
| [`docs/worker.md`](docs/worker.md) | `apps/worker` — job handlers, the full `render-clip` pipeline, Smart Reframe, captions, B-roll |
| [`docs/queue.md`](docs/queue.md) | BullMQ queue design, self-chaining, retry semantics |
| [`docs/database.md`](docs/database.md) | Prisma schema overview, `Clip`'s AI-signal columns, retry inference |
| [`docs/prisma.md`](docs/prisma.md) | Prisma-specific conventions, `Prisma.JsonNull`, the TS2742 pitfall in detail |
| [`docs/redis.md`](docs/redis.md) | Redis usage (BullMQ backing store, rate limiting) — never durable state |
| [`docs/docker.md`](docs/docker.md) | Image builds, MinIO (dev) vs. R2 (prod) storage |
| [`docs/deployment.md`](docs/deployment.md) | Production compose, env var layering |
| [`docs/backup-restore.md`](docs/backup-restore.md) | Automated Postgres/object-storage backup (`ops/backup`), verification, restore procedure, `GET /backups` |
| [`docs/monitoring.md`](docs/monitoring.md) | Lightweight operational monitoring endpoints (`/metrics`, `/queues`, `/workers`, `/storage`, `/database`, `/redis`) — no Prometheus/OpenTelemetry |
| [`docs/alerting.md`](docs/alerting.md) | Alert-condition foundation (thresholds, internal alert states) — no external integrations |
| [`docs/operations-runbook.md`](docs/operations-runbook.md) | Backup, restore, disaster recovery, node/worker replacement, database/storage recovery procedures |
| [`docs/production-hardening-report.md`](docs/production-hardening-report.md) | Final engineering report for the backup/rate-limiter/monitoring/alerting initiative — every change by phase, files touched, remaining tech debt, deferred items, roadmap, readiness score |
| [`docs/testing.md`](docs/testing.md) | Module vs. adapter test split, real-Postgres verification, known verification gaps |
| [`docs/export-center-manual-verification.md`](docs/export-center-manual-verification.md) | Manual pre-merge checklist for Export Center download routes (Sprint 03b) — real-browser download behavior, Excel/VLC compatibility, UTF-8/BOM correctness; complements the automated suite, doesn't replace it |
| [`docs/ai/llm.md`](docs/ai/llm.md) | The `detect-clips` LLM call — clip selection, `ClipScores`, hooks/hashtags, emoji suggestions |
| [`docs/ai/vision.md`](docs/ai/vision.md) | Face detection/reframe, Face Intelligence (23 sub-features), Gesture Intelligence, Scene Intelligence |
| [`docs/ai/audio.md`](docs/ai/audio.md) | Loudness/RMS/speaking-rate, Speaker Diarization, Vocal Emotion Detection |
| [`docs/ai/ocr.md`](docs/ai/ocr.md) | On-screen text detection, tracking, classification, evaluation tooling, Review UI |
| [`docs/ai/fusion.md`](docs/ai/fusion.md) | The Fusion Engine — current pipeline, weights, prediction/recommendation |
| [`docs/ai/fusion-v3.md`](docs/ai/fusion-v3.md) | Fusion Engine v3 (Milestones 2A-B) — `packages/fusion-ml`'s ML abstractions/interfaces/mock implementations (2A), plus (2B) a real Prisma-backed dataset builder, real dataset/feature versioning, a real evaluation runner, and a real gradient-descent baseline linear model, orchestrated by `runFusionV3Pipeline()`; v2 remains the only engine in production, nothing here is wired into `render-clip.worker.ts` |
| [`docs/ai/scoring.md`](docs/ai/scoring.md) | How `viralityScore`/`ClipScores`/`highlightScore` relate (they are three different systems) |
| [`docs/ai/speaker-intelligence.md`](docs/ai/speaker-intelligence.md) | Speaker Intelligence roadmap (VAD, Active Speaker Detection, Face-Voice Association, Speaker Timeline/Scoring) — contracts-only status vs. what's already covered by Face/Audio/Gesture Intelligence |
| [`docs/ai/object-intelligence.md`](docs/ai/object-intelligence.md) | Object Intelligence roadmap (per-entity detection/tracking/behavioral features — a separate package from Scene Intelligence) — MediaPipe detector choice, multi-object tracker design, Batch OI-1 through OI-5 (complete) |
| [`docs/ai/composition-intelligence.md`](docs/ai/composition-intelligence.md) | Composition Intelligence roadmap (rule of thirds, headroom, lead room, centering, composition stability, framing consistency, subject loss ratio) — reclassifies an earlier 15-batch "Camera Intelligence" proposal, most of which turned out to already be Scene/Motion/Object Intelligence; **complete** — contract, `packages/composition-intelligence` derive functions, the standalone `packages/primary-subject` selection package, worker adapter, and Fusion Engine wiring (RB-1/RB-2) are all done at weight 0, pending calibration |
| [`docs/ai/dataset-feedback-loop.md`](docs/ai/dataset-feedback-loop.md) | Dataset & Feedback Loop (post-hardening roadmap Milestone 1) — `PublishRecordStatsSnapshot` engagement history, the `engagementScore` heuristic, and `export-training-dataset.ts`'s feature/outcome join + correlation read, the prerequisite for Fusion Engine v3's ML-based weighting |
| [`docs/ai/dataset-validation-calibration.md`](docs/ai/dataset-validation-calibration.md) | Dataset Validation & Calibration (post-hardening roadmap Milestone 1.5, between Milestone 1 and Fusion Engine v3) — `generate-dataset-report.ts`'s Dataset Health Report (Missing Data, Feature Distribution, Feature Drift Detection, Correlation Dashboard, Weight Calibration Report), and the two-tier `dataset-lib.ts` data model that makes most of it useful ahead of real engagement data |

## Status

MVP (upload → transcript → auto-clip → caption → download, retry, object storage, Docker/deploy
readiness) is complete and in production.

Everything since the MVP has followed one architectural throughline: the **JSON-contract stateless
module pattern** (`ARCHITECTURE.md`) — proven on a reference module, then used to migrate existing
worker logic, then to add DB audit-trail infrastructure, then proven again on a feature built from
scratch. On top of that pattern sits the **AI Fusion & Multi-Modal Highlight Scoring** initiative:
independent analysis modules for Audio, Scene, Facial, Gesture, OCR, and LLM-derived signals, each
feeding a shared Fusion Engine that produces one explainable `highlightScore` per clip.

High-level state of each major initiative (see the linked docs for what's actually implemented):

- **Editor & rendering features** (Timeline Editor, Smart Reframe/Auto Zoom, caption styling,
  Sentry observability, hook/hashtag generation, Publish Center for YouTube/TikTok/Instagram,
  premium transcription payments, Content Intelligence scoring, Smart Trim/silence removal,
  cross-clip heatmap dashboard, Smart Transitions, Auto B-roll with a 3-provider adapter, B-roll
  normalization, seamless long-video chunking) — all shipped. See `worker.md`, `frontend.md`,
  `backend.md`.
- **JSON-contract module pattern** — established, applied to every existing worker module, proven
  on state-machine audit-trail infra and on a feature built from scratch. See `ARCHITECTURE.md`.
- **Audio / Scene / Facial Intelligence** (Checkpoint 1) — done. **Mini Fusion Engine v1 → v2 →
  v2.1** — done (weighted feature-level fusion, confidence, explainability, ranking, LLM signal,
  prediction/recommendation). See `ai/fusion.md`.
- **Gesture Intelligence, Face Intelligence (5 batches, 23 sub-features), Scene Intelligence
  taxonomy (cut classification, motion energy, directional camera motion, plus the derived-only
  Motion Intelligence batches SC-4 through SC-7 — Motion Direction, Peak Detection, Complexity,
  Smoothness/Camera Jitter)** — done, all wired into the Fusion Engine at weight 0 pending
  calibration. See `ai/vision.md`.
- **OCR Intelligence** (detection → tracking/classification → evaluation tooling → dataset
  annotation UI) — done through OCR-2.5, wired into the Fusion Engine at a real 10% weight. OCR-3
  (object detector) and OCR-4 (scene understanding) are deferred pending a real annotated dataset.
  See `ai/ocr.md`.
- **Object Intelligence roadmap** (per-entity detection/tracking/behavioral features — people,
  vehicles, products, animals) — a separate package from Scene Intelligence, **complete** (OI-1
  through OI-5, closing out the originally-scoped 10-feature taxonomy). Batch OI-1 (Foundation:
  MediaPipe Object Detector + a genuinely multi-object tracker generalizing OCR Intelligence's
  tracker), OI-2 (motion speed/direction, reusing Scene Intelligence's `CameraMotionDirectionType`),
  OI-3 (occlusion — the first OI feature comparing detections across the same frame, not just
  across time), OI-4 (interaction, exposed as `interactionConfidence` — a 3-component composite of
  proximity/temporal co-presence/distance trend, explicitly named to avoid implying real
  interaction detection this pipeline has no depth/pose/action recognition to support), and OI-5
  (`objectAttentionScore` — not a flat average but a "domain of domains" composite of Visibility/
  Activity/Social sub-scores, mirroring the top-level Fusion Engine's own layered shape one level
  down, plus a separate `objectAttentionConfidence` reliability signal mirroring Speaker
  Intelligence's confidence-score pattern) are all done, wired into the Fusion Engine at weight 0.
  See `ai/object-intelligence.md`.
- **Editing Rhythm** (tempo/pacing/acceleration, a composite signal built from other signals'
  already-computed features) — done, wired at a heuristic (unvalidated) 5% weight since production
  has 0 usable samples to calibrate against yet (`apps/worker/src/scripts/
  check-calibration-coverage.ts` is the reusable check — rerun it as production data accumulates).
  See `ai/fusion.md`.
- **Speaker Intelligence roadmap** (VAD, Active Speaker Detection, Face-Voice Association, Lip
  Sync Verification, Speaker Timeline, Speaker Quality/Confidence/Importance/Engagement/
  Attention/Highlight scoring, Conversation Type Classification) — **this doc's "contracts only,
  no detectors/wiring built yet" status is stale** (confirmed while wiring Composition
  Intelligence's Primary Subject Selection, which consumes Active Speaker Detection's real output
  directly): `packages/active-speaker-intelligence` (`detectActiveSpeaker`,
  `associateSpeakersWithFaces`, `verifyLipSync`) and `packages/speaker-scoring`
  (confidence/engagement/importance/highlight scoring) are fully implemented and already wired into
  `render-clip.worker.ts` and the Fusion Engine (`speaker` key, weight 0). A full re-audit of
  exactly which roadmap items are done vs. still contracts-only hasn't been done — treat this bullet
  and `ai/speaker-intelligence.md` as needing a refresh pass, not as accurate today.
- **Composition Intelligence roadmap** (rule of thirds, headroom, lead room, centering, composition
  stability, framing consistency, subject loss ratio) — a reclassification of an earlier proposed
  15-batch "Camera Intelligence" subsystem, most of which turned out to already be Scene/Motion/
  Object Intelligence under a camera-flavored name. **Complete**: the contract
  (`packages/contracts/src/composition-intelligence.ts`), the derive-function package
  (`packages/composition-intelligence`), a standalone, deliberately non-composition-specific
  Primary Subject Selection package (`packages/primary-subject` — reusable by a future Thumbnail
  Intelligence/Reframe/Multi-Subject initiative, not buried as a private detail of this one), the
  `render-clip.worker.ts` adapter, and Fusion Engine wiring (a new `composition` key, weight 0) are
  all done. See `ai/composition-intelligence.md`.
- **Open**: real dissolve-transition detection, Eye Contact/Gesture/OCR/Composition/etc. weight
  calibration against real engagement data, pitch/F0 audio tracking, a Speaker Intelligence
  re-audit (see above), Video Quality Intelligence (focus/exposure/noise/compression — a separate,
  not-yet-scoped roadmap explicitly split out of Composition Intelligence), and the eventual
  Multi-Modal Fusion Engine (whether it enriches `clip-scoring`'s LLM-selected candidates or
  replaces selection with a continuous importance timeline is an explicit open architectural
  question — see `ai/fusion.md`).
- **Dataset & Feedback Loop** (Milestone 1 of the post-production-hardening AI-quality roadmap) —
  the prerequisite for turning the Fusion Engine from rule-based weights into a trained model.
  `PublishRecordStatsSnapshot` (append-only engagement history), `shareCount`/Instagram
  `watchTimeSeconds` on the existing `sync-publish-stats` job, the `engagementScore` heuristic, and
  `export-training-dataset.ts`'s feature/outcome join + correlation read are all done. YouTube
  watch-time/CTR (needs a new OAuth scope + user reconnect) and TikTok watch-time (no such platform
  endpoint) are explicit, documented scope cuts, not gaps. See `ai/dataset-feedback-loop.md`.
- **Dataset Validation & Calibration** (Milestone 1.5, inserted between Milestone 1 and Fusion
  Engine v3) — turns the raw dataset into insights before M2's model-training work starts.
  `generate-dataset-report.ts` (`pnpm report:dataset-health`) produces one Dataset Health Report
  covering Missing Data, Feature Distribution, Feature Drift Detection, a Correlation Dashboard, and
  a Weight Calibration Report (heuristic suggestion only, not auto-applied to
  `packages/fusion-engine/src/weights.ts`). Missing Data/Distribution/Drift run over every clip with
  computed Fusion Engine features, not just published ones, so they're useful ahead of Milestone 1's
  engagement data — verified against dev data. See `ai/dataset-validation-calibration.md`.
- **Fusion Engine v3** — has its own lettered sub-sequence inside this roadmap slot: M2A Foundation
  (done) → M2B Real ML Pipeline (done) → wait for production samples → M2C Baseline ML Training →
  M2D Calibration → M2E Canary Rollout → M2F Production Switch. **v2 (`packages/fusion-engine`)
  remains the only engine in production throughout** — zero call sites added in
  `apps/worker`/`apps/api`; `render-clip.worker.ts` is untouched.
  - **M2A (Foundation)**: ML abstractions (`FeatureVector`/`TrainingSample`/`PredictionResult`/
    `RankingResult`/`ModelMetadata` in `packages/contracts/src/fusion-ml.ts`), the 5 requested
    interfaces (`FeatureExtractor`/`DatasetBuilder`/`ModelTrainer`/`ModelEvaluator`/`Predictor`,
    each with one `Mock*` implementation), a model registry (`InMemoryModelRegistry`), and a real
    offline evaluation framework (Precision@K/Recall@K/Spearman/NDCG). A new
    `FUSION_ENGINE_V3_ENABLED` env var (default off) establishes this codebase's first feature-flag
    convention, read by `isFusionV3Enabled()` but not consumed anywhere yet.
  - **M2B (Real ML Pipeline)**: the pipeline stopped being framework-only. `ProductionDatasetBuilder`
    (`apps/worker/src/ml/`) is a real, Prisma-backed adapter reusing Milestone 1.5's
    `loadUsableSamples()`, bridged via a new `FUSION_V2_TO_V3_SIGNAL_MAP` (v2's `facial` → v3's
    `emotion`, everything else maps to itself). `computeDatasetVersion()`/`computeFeatureVersion()`
    are real deterministic sha256-based versioning, feeding a new `FeatureRegistry` alongside
    M2A's `ModelRegistry` (both still in-memory only — no real storage backing yet, same call as
    M2A). `BaselineLinearModelTrainer`/`BaselineLinearPredictor` are real gradient-descent linear
    regression (not a placeholder), and `runFusionV3Pipeline()` orchestrates all of it end-to-end,
    proven by an automated test (`pipeline.spec.ts`) — this **is** the milestone's "End-to-End
    Pipeline Verification." `pnpm --filter @speedora/worker pipeline:fusion-v3` is the real entry
    point; against production's still-0 usable samples it reports that honestly (`--mock` shows a
    full run against synthetic data). See `ai/fusion-v3.md`.

- **AI Explainability** (Milestone 4) — a read-only, per-clip view of the Fusion Engine's output
  (`GET /clips/:id/explainability`, `/videos/:id/explainability` page). No scoring-pipeline changes;
  `results: [{ engine: 'v2', ... }]` is deliberately an array so a future engine can append a second
  entry without a contract change — this pattern is reused by every Milestone 5C-B `/ops/ai/*`
  response.
- **Analytics Dashboard** — split into three stages, the user's own recommended breakdown so each
  stays small and independently verifiable: **M5A Overview** (`/analytics`, totals/platform-breakdown/
  upload-trend, owner-scoped) → **M5B Performance** (top clips/videos, engagement trend, platform
  comparison, a first light AI Performance Summary) → **M5C**, which the user split further into
  **M5C-A User AI Analytics** (a small owner-scoped addition to M5B's AI Performance Summary:
  Highlight Score Distribution + per-signal Contribution %) and **M5C-B AI Operations Dashboard**
  (`/ops/ai`, system-wide — pools every user's clips rather than one, role-gated to `ADMIN`/
  `AI_ENGINEER`/`OPERATOR` since it's an engineering "is the model healthy?" surface, not a creator
  "how did my content do?" one). M5C-B is also where Milestone 1.5's Missing Data/Feature
  Distribution/Feature Drift/Correlation/Weight Calibration — previously only reachable via
  `generate-dataset-report.ts`'s CLI output — got a web UI for the first time, plus two new sections
  (AI Health, Training Readiness for the eventual M2C). The underlying M1.5 pure functions moved to a
  new shared package, `packages/dataset-quality`, so both `apps/worker`'s CLI script and `apps/api`'s
  `/ops/ai/*` can reuse the exact same tested logic (apps only talk over HTTP/queue, so it couldn't
  stay in `apps/worker`). All done. This was also this codebase's first role concept
  (`UserRole` on `User`) — see `docs/backend.md`'s "AI Operations Dashboard" section and
  `docs/operations-runbook.md` for granting a role.

For new feature work: check whether it's an extension of an existing signal/module first (extend,
don't rebuild — this has been an explicit recurring instruction across the AI Fusion roadmap), and
follow the JSON-contract checklist in `ARCHITECTURE.md` for anything new.
