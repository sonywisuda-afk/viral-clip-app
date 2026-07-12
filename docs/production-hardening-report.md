# Production-hardening initiative — final engineering report

**Date**: 2026-07-12
**Scope**: `apps/api`, `apps/worker`, `packages/shared`, `packages/storage`, `docker-compose.yml`,
`docker-compose.prod.yml`, `ops/backup` (new)
**Method**: a ground-truth, code-grounded audit (four parallel reviews covering telemetry,
performance/scalability, configuration/security, and disaster-recovery/documentation) followed by a
four-phase implementation pass, each phase built, typechecked, and exercised end-to-end against the
live dev stack (real Postgres, Redis, MinIO, and the running `apps/worker` process) before being
marked done.

---

## 1. Executive summary

Prior hardening work (idempotent workers, atomic DB updates, optimistic concurrency, job-level
checkpointing, graceful shutdown, health endpoints, checksum verification, structured JSON logging,
queue reliability) covered *correctness and durability* well. The audit that opened this initiative
found the gap was *visibility and recoverability* — the operational layer that lets a team see the
system in production and get it back after a disaster. Two findings stood out as genuinely urgent
rather than nice-to-have:

- **No database or object-storage backup existed at all.** A bad migration, a `docker compose down
  -v`, or a disk failure would have meant total, unrecoverable data loss.
- **The login rate limiter used in-memory storage**, so its effective threshold would silently
  multiply by replica count the moment `apps/api` was scaled beyond one instance — the one finding
  in the whole audit that was an actual security bypass, not just a missing metric.

Both are now fixed, tested end-to-end with real data (a real Postgres dump was restored into a
scratch database and verified row-for-row; a real object-storage snapshot was restored into a
scratch bucket and verified checksum-for-checksum). On top of that, `apps/api` now exposes six
lightweight monitoring endpoints and an alert-condition foundation, none of which existed before,
and all of which reuse data the system was already computing rather than standing up parallel
infrastructure. No live security vulnerability was found at any point in this initiative. No
database schema changes were required — every new capability is additive at the infrastructure,
endpoint, or utility-module level.

## 2. Every implemented change, grouped by phase

### Phase 1 — Backup, restore, and disaster-recovery foundation

1. **Automated Postgres backup** — `ops/backup/backup-postgres.sh` runs `pg_dump -Fc` on a
   schedule (`BACKUP_INTERVAL_HOURS`, default 24; also runs once immediately on container start).
2. **Automated object-storage backup** — `ops/backup/backup-storage.sh` runs `mc mirror` against
   whichever S3-compatible endpoint is configured (MinIO in dev, R2 in prod — no code difference
   between them), producing a dated, independently-restorable snapshot directory per run.
3. **Retention policy** — both scripts prune dumps/snapshots older than `BACKUP_RETENTION_DAYS`
   (default 14) after every successful run.
4. **Integrity verification** — `verify-postgres-backup.sh` checks a SHA-256 sidecar and runs
   `pg_restore --list` (a cheap table-of-contents read, no database touched) after every backup, plus
   an opt-in `--full` mode that actually restores into a scratch database. `verify-storage-backup.sh`
   recomputes and diffs a SHA-256 manifest for every object in a snapshot.
5. **Restore scripts** — `restore-postgres.sh` / `restore-storage.sh`, both destructive by design and
   both refusing to run without an explicit `--yes`. **Exercised for real** during this initiative:
   a captured dump was restored into a scratch Postgres database (`speedora_restore_test`) and its
   11 tables and real row data were confirmed present; a captured snapshot was restored into a
   scratch MinIO bucket and confirmed byte-identical.
6. **Documented restore procedure** — `docs/backup-restore.md`, covering configuration, manual
   verification commands, the full restore procedure for both Postgres and storage, and an explicit
   callout that off-box copies of the backup volume are still a manual step (see §10/§11).
7. **Automated backup health checks** — `GET /backups` (`apps/api/src/health/backups.controller.ts`,
   backed by `apps/api/src/health/backup-status.ts`) reads the status files the backup scripts write
   after every run and reports `stale: true` if the last run failed or is older than
   `BACKUP_STALE_AFTER_HOURS` (default 48).

### Phase 2 — Redis-backed rate limiting

- Replaced `@nestjs/throttler`'s default in-memory storage (per-process, so N `apps/api` replicas
  would have silently allowed `5 × N` login attempts/minute instead of 5) with
  `apps/api/src/auth/redis-throttler-storage.service.ts` — a from-scratch Redis-backed
  implementation using an atomic Lua script (a sliding-window sorted-set, not a coarser fixed-window
  counter, to faithfully reproduce the original library's actual per-hit-expiry semantics) and
  Redis's own clock (`TIME`) so replicas agree on "now" even with clock drift between hosts.
- Existing rate-limit semantics preserved exactly: same 5-attempts/60-second threshold, same
  block-duration behavior, same response headers — verified by reading `@nestjs/throttler`'s own
  source (`throttler.guard.js`, `throttler.service.js`) rather than assuming.
- No new large dependency: `ioredis` was already used elsewhere in this monorepo (`apps/worker`) and
  is now a direct dependency of `apps/api` too, reusing the exact version already in use.

### Phase 3 — Lightweight operational monitoring

Six new endpoints on `apps/api` (`apps/api/src/monitoring/`), deliberately **not** built on
Prometheus/OpenTelemetry/Grafana per explicit scope — plain JSON, computed from data the system
already has:

| Endpoint | What it reports |
|---|---|
| `GET /metrics` | Process uptime/memory/CPU (Node built-ins), cumulative HTTP request counts, and a 24-hour pipeline rollup (videos by status, video failures, render-job count/avg duration, node-execution failure rate) reusing the *existing* render-graph telemetry (`JobExecution`/`NodeExecution`) and status audit trail (`VideoStatusEvent`) rather than a parallel metrics path |
| `GET /queues` | Per-queue job counts (waiting/active/completed/failed/delayed/paused) for **every** queue in the system, plus a bounded heuristic for likely-stalled jobs |
| `GET /workers` | Connected worker count per queue, read from BullMQ's own worker registry |
| `GET /storage` | Object-storage reachability + aggregate usage (object count, total size), via a new bounded `getBucketUsage()` in `packages/storage` |
| `GET /database` | Postgres reachability + round-trip latency |
| `GET /redis` | Redis reachability + round-trip latency + used-memory bytes |

`QueueModule` was extended to also register the two worker-only queues
(`SCHEDULE_PUBLISH_CLIP`/`SYNC_PUBLISH_STATS`, read-only from `apps/api`'s side) so `/queues` and
`/workers` report the whole pipeline, not just the queues `apps/api` happens to produce into.

### Phase 4 — Alerting foundation

- `packages/shared/src/utils/alert-conditions.ts` — pure, dependency-free predicate functions
  (`isQueueBacklogged`, `isFailureRateHigh`, `hasLikelyStalledJobs`, `isWorkerOffline`,
  `isDependencyDown`, `isBackupStale`, `isHeapPressureHigh`) plus a `DEFAULT_ALERT_THRESHOLDS` object
  — no external integration, no scheduler, matching this codebase's existing convention of small
  dependency-free utilities.
- `GET /alerts` (`apps/api/src/monitoring/monitoring.controller.ts`) evaluates every condition
  against the data the five endpoints above already compute, and tracks "internal alert state" via
  `apps/api/src/monitoring/alert-state.ts` — an in-memory map from alert id to the timestamp it first
  became true, so a poller sees "backlogged since 14:02", not just "backlogged: true", with no
  database table or background job. Verified end-to-end: a real heap-pressure condition appeared
  mid-session, was assigned a fresh `since`, and correctly kept that same `since` on every subsequent
  poll while it remained true.

## 3. Architecture changes

- **New service**: `backup` (`ops/backup/Dockerfile`, based on `postgres:16-alpine` so
  `pg_dump`/`pg_restore` exactly match the server image used everywhere else in the stack) — wired
  unconditionally into `docker-compose.prod.yml` and profile-gated (`--profile backup`) in
  `docker-compose.yml` so it doesn't run by default in dev.
- **New named volumes**: `backup-data` (dumps/snapshots) and `backup-status` (small JSON status
  files), the latter mounted read-only into `apps/api` so it can serve `GET /backups` without ever
  touching Postgres/storage credentials for that purpose.
- **New module**: `MonitoringModule` (`apps/api/src/monitoring/`), imported by `AppModule` alongside
  a globally-applied `RequestMetricsMiddleware` for HTTP request counting.
- **Extended module**: `QueueModule` now registers all 7 queues in the system (previously 5),
  read-only for the 2 apps/api never produces into.
- **Extended module**: `AuthModule`'s `ThrottlerModule` registration switched from `forRoot` (array
  shorthand) to `forRootAsync` with a Redis-backed storage provider, deferring the Redis connection
  until DI instantiation time (after `ConfigModule` has loaded `.env`) — same pattern already used by
  `JwtModule.registerAsync` in the same file.
- **Extended package**: `packages/storage` gained one new export (`getBucketUsage`) with no change
  to any existing export's signature or behavior.
- **Extended package**: `packages/shared` gained one new utility module
  (`utils/alert-conditions.ts`), exported from the package root alongside the existing utils.
- **No new external service dependency** beyond what's already in this stack (Postgres, Redis, an
  S3-compatible endpoint) — the `backup` service's only "new" runtime dependency is the MinIO client
  binary (`mc`), copied in at build time from the official `minio/mc` image, not installed from an
  unpinned network source.

## 4. Files added

```
apps/api/src/auth/redis-throttler-storage.service.ts   (125 lines)
apps/api/src/health/backup-status.ts                    (65 lines)
apps/api/src/health/backups.controller.ts               (13 lines)
apps/api/src/monitoring/alert-state.ts                  (51 lines)
apps/api/src/monitoring/metrics-registry.ts             (45 lines)
apps/api/src/monitoring/monitoring.controller.ts       (366 lines)
apps/api/src/monitoring/monitoring.module.ts             (9 lines)
apps/api/src/monitoring/request-metrics.middleware.ts   (15 lines)
packages/shared/src/utils/alert-conditions.ts           (81 lines)

docs/alerting.md                                        (72 lines)
docs/backup-restore.md                                 (122 lines)
docs/monitoring.md                                       (84 lines)
docs/operations-runbook.md                             (156 lines)
docs/production-hardening-report.md                     (this file)

ops/backup/Dockerfile                                   (17 lines)
ops/backup/lib.sh                                        (29 lines)
ops/backup/backup-postgres.sh                            (53 lines)
ops/backup/backup-storage.sh                             (60 lines)
ops/backup/verify-postgres-backup.sh                     (48 lines)
ops/backup/verify-storage-backup.sh                      (19 lines)
ops/backup/restore-postgres.sh                           (37 lines)
ops/backup/restore-storage.sh                            (36 lines)
ops/backup/entrypoint.sh                                 (27 lines)
```

## 5. Files modified

| File | Change |
|---|---|
| `.env.example` | Added `BACKUP_INTERVAL_HOURS`/`BACKUP_RETENTION_DAYS`/`BACKUP_STALE_AFTER_HOURS`, documented |
| `CLAUDE.md` | Added four new rows to the documentation index (backup-restore, monitoring, alerting, operations-runbook) |
| `apps/api/package.json` | Added `ioredis` (pinned to the same version already used by `apps/worker`) |
| `apps/api/src/app.module.ts` | Registered `MonitoringModule`; applied `RequestMetricsMiddleware` globally via `configure()` |
| `apps/api/src/auth/auth.module.ts` | `ThrottlerModule.forRoot` → `forRootAsync` with `RedisThrottlerStorage` |
| `apps/api/src/health/health.module.ts` | Registered `BackupsController` |
| `apps/api/src/queue/queue.module.ts` | Registered the 2 previously-missing queues, read-only |
| `docker-compose.prod.yml` | Added `backup` service (unconditional), `backup-data`/`backup-status` volumes, mounted `backup-status` read-only into `api` |
| `docker-compose.yml` | Added `backup` service (profile-gated), same two volumes |
| `packages/shared/src/index.ts` | Export `utils/alert-conditions` |
| `packages/storage/src/index.ts` | Added `getBucketUsage()` (bounded `ListObjectsV2` pagination) |
| `pnpm-lock.yaml` | Updated for the new `ioredis` dependency in `apps/api` |

Net diff on already-tracked files: **12 files changed, 216 insertions(+), 32 deletions(-)**, plus the
29 new files listed above. No pre-existing file's behavior changed except the four call sites
listed in the table (throttler storage, queue registration, module wiring, one new export each in
two packages) — nothing else in `apps/api`/`apps/worker`/`packages/*` business logic was touched.

## 6. Database migrations

**None.** No Prisma schema changes were required or made, and no migration files were added. Every
new capability is deliberately additive at a layer *other* than the database schema:

- Backup status lives in two small JSON files on a shared volume, not a table.
- Rate-limit counters live in Redis (sorted sets + a block-marker key), not Postgres.
- Every monitoring/alerting endpoint computes its answer from data already stored in existing
  tables (`Video`, `VideoStatusEvent`, `JobExecution`, `NodeExecution`) or from BullMQ/Redis/S3
  state directly — nothing new is persisted to Postgres.

This was a deliberate choice, not an oversight: a schema change would have added migration risk to
an initiative whose whole point was *reducing* operational risk, for no capability that actually
needed durable relational storage.

## 7. Operational improvements

- A production deployment now has a working, tested backup/restore path where it previously had
  none (§1, §2).
- `docs/operations-runbook.md` gives scenario-driven procedures (Redis lost, Postgres lost, whole
  host lost, node replacement, worker replacement, database recovery, storage recovery) that
  cross-reference the mechanisms above rather than re-describing them.
- Six new monitoring endpoints exist where zero did before, all reusing existing data rather than
  standing up parallel infrastructure — see §2/Phase 3.
- `GET /alerts` gives a single "what's wrong right now, and since when" view built entirely from
  those endpoints, with no new infrastructure to operate.
- Scaling worker capacity is now explicitly documented as `docker compose ... up -d --scale
  worker=<N>` with the reasoning for why this is safe (`subprocessLimiter.ts`'s per-process budget is
  additive across replicas, by design).

## 8. Reliability improvements

- **Closed the single largest gap found in the initial audit**: total, unrecoverable data loss from
  a bad migration, `down -v`, or disk failure is no longer possible without also losing the backup
  volume itself (and even that is mitigated once the documented off-box copy step is followed — see
  §11).
- Backup integrity is checked automatically after every run (checksum + TOC read for Postgres,
  checksum manifest for storage) rather than assumed.
- `GET /queues`' likely-stalled-job heuristic gives visibility into a failure mode (a job stuck
  `active` with no progress) that previously had no signal at all short of manually inspecting Redis.
- The rate-limiter fix (§2) means `apps/api` can now actually be scaled to multiple replicas without
  silently weakening login brute-force protection — previously, doing so would have been a regression
  nobody could see happening.

## 9. Security improvements

- **Phase 2 (Redis-backed rate limiter)** is the one change in this initiative that closes an actual
  security gap rather than adding visibility: previously, horizontally scaling `apps/api` would have
  silently multiplied the effective login-attempt limit by replica count. That gap is now closed.
- No live vulnerability was found or fixed elsewhere in this initiative — the preceding audit
  (config/security fork) had already verified secret handling, temp-file handling, storage
  permissions, Docker user, subprocess invocation, and resource limits as clean. Two low-priority,
  no-live-vulnerability opportunistic items from that audit (a Midtrans env cross-check, an
  upload-extension allowlist) were **not** implemented in this initiative — see §11.
- The new `backup` service's container is built from a pinned, official base image
  (`postgres:16-alpine`) with `mc` copied in from the official `minio/mc` image at build time, not
  downloaded from an unpinned URL at runtime.
- Restore scripts (`restore-postgres.sh`/`restore-storage.sh`) are destructive by design and require
  an explicit `--yes` — they cannot fire from an accidental invocation the way a read-only backup run
  can.

## 10. Remaining technical debt

- **Off-box backup replication is still a manual step.** `backup-data`/`backup-status` are named
  Docker volumes on the same host as the live database — real protection against logical failures
  (bad migration, accidental delete) but not against host-level loss (disk failure, host loss).
  `docs/backup-restore.md` documents the manual copy command; it is not automated.
- **`GET /metrics`'s HTTP counters and `GET /alerts`'s internal alert state are both process-local.**
  With N `apps/api` replicas, each reports only its own share of traffic/alert history; restarting a
  replica resets its alert `since` timestamps. Acceptable for a single-instance deployment or as a
  per-instance debugging signal; not a substitute for a real aggregated backend if one is adopted.
- **`GET /storage`'s bucket-usage scan is bounded to 20 pages (~20,000 objects).** A bucket larger
  than that returns `truncated: true` with a count/size that's a lower bound, not the true total —
  correctly flagged, but not a complete answer for a very large bucket.
- **Worker restart resumes at the stage level, not the sub-stage level** — a worker killed mid-stage
  re-runs that whole stage from scratch on retry (e.g. a killed transcribe job re-transcribes the
  whole video). This is an existing, deliberate design (documented more precisely as part of this
  initiative — see `docs/operations-runbook.md`'s Worker replacement section), not something this
  initiative changed, but it remains a real cost on worker crash/restart.
- **`apps/api` cannot yet be horizontally scaled end-to-end** — `docker-compose.prod.yml` publishes
  a fixed host port (`API_PORT:3001`) for the `api` service, which Docker Compose cannot scale past
  one replica without a reverse proxy/load balancer in front. The rate-limiter fix (§2) removes the
  *correctness* blocker to scaling; the *infrastructure* to actually do it (a load balancer) doesn't
  exist in this stack yet.
- **Alert thresholds are uncalibrated defaults**, not derived from real production traffic — same
  posture as several existing weight-0 signals elsewhere in this codebase (see `CLAUDE.md`'s Fusion
  Engine section).

## 11. Deferred items, with reasons

| Item | Reason deferred |
|---|---|
| Prometheus / OpenTelemetry / Grafana | Explicitly out of scope per instruction — "lightweight monitoring... no large infrastructure" |
| Distributed tracing | A shared correlation ID gets most of the debugging value without a collector/exporter, at this pipeline's current linear, low-fan-out complexity |
| Background alert-evaluation scheduler / external alert delivery (Slack, PagerDuty, email, etc.) | No external sink exists yet; a scheduler writing alerts nobody polls has no value until one is adopted — explicitly out of scope per instruction |
| Redis/Postgres/storage latency **histograms** (beyond the simple round-trip check already added) | Binary reachability + a single latency sample matters far more than percentile distributions at single-instance-per-service scale |
| Composite index on `PremiumCredit(userId, status, videoId)` | Table is bounded by one-time purchases per user — no measurable query cost at current or plausible near-term scale |
| Broader environment-variable cross-validation beyond the one documented Midtrans pair | Every other optional credential group already fails independently and gracefully; there is no other real coupling to validate |
| A standalone `/workers`-only registration mechanism | BullMQ's own `getWorkers()` already tracks this — building a separate mechanism would duplicate it |
| Upload-extension allowlist (`storage.service.ts`) | Identified in the preceding security audit as defense-in-depth only, no live vulnerability (the object key's user-controlled portion is already reduced to just the extension, with the filename itself replaced by a UUID) — low priority, not implemented this session |
| Midtrans `IS_PRODUCTION` cross-field consistency check | Same audit, same low-priority/opportunistic classification — not implemented this session |
| Automated off-box backup replication | Requires an operator decision about *where* (a second host? a different cloud account? a different provider?) that this repository cannot make on its own — deliberately left as a documented manual step, not a code gap |
| Sub-stage (mid-job) checkpoint/resume for workers | A materially bigger redesign of the render-graph/job-execution model; today's stage-level idempotency was judged sufficient given actual job durations, and re-scoping it was out of bounds for this initiative |
| Disk-near-full / CPU-saturation alert conditions | Not implemented because they are not yet **measurable**: this stack doesn't collect host-level disk usage, and Node's `cpuUsage()` is cumulative, not a rate, so a single-sample threshold would never fire meaningfully. Deferred until there's a real signal to threshold against, rather than shipping an alert condition that can't work |

## 12. Suggested roadmap for the next milestone

Ordered by how directly each depends on what shipped this initiative:

1. **Automate off-box backup replication.** The single highest-leverage remaining item — everything
   else in the backup story is done and tested; this is the one piece still manual.
2. **Add a reverse proxy / load balancer to `docker-compose.prod.yml`** so `apps/api` can actually be
   scaled to multiple replicas — the rate-limiter fix already removed the correctness blocker; only
   the infrastructure is missing.
3. **Run a full restore drill on a schedule** (not just backup verification) — periodically prove the
   documented restore procedure still works as the schema evolves, not only right after it was
   written.
4. **Calibrate `DEFAULT_ALERT_THRESHOLDS`** against real production traffic once there's enough of it
   to be meaningful, the same exercise already planned for the Fusion Engine's weight-0 signals.
5. **Implement the two deferred low-priority security items** (Midtrans cross-check, upload-extension
   allowlist) opportunistically — no urgency, but cheap once picked up.
6. **Revisit the two explicitly-skipped alert conditions** (disk, CPU) if/when a host-level metrics
   source is adopted that makes them measurable.
7. **Decide whether alert state / metrics should move off process-local storage** (e.g. into Redis)
   if/when multi-replica `apps/api` and a real external alerting sink both exist — no need to build
   this speculatively before either does.
8. Separately from this initiative: `CLAUDE.md` already flags a stale Speaker Intelligence
   roadmap re-audit as an open item — unrelated to production hardening, but worth noting it's still
   outstanding.

## 13. Estimated production-readiness score

**7.5 / 10** — a substantial, verified improvement over the pre-initiative baseline, with the
remaining gap concentrated in two well-understood, already-scoped items (off-box replication,
multi-replica API infrastructure) rather than anything unknown or unaddressed.

| Category | Score | Justification |
|---|---|---|
| Data durability & DR | 8/10 | Backup, verification, retention, and restore are implemented and were exercised end-to-end with real data — a full letter grade better than "no backup at all." Held back from 9-10 only by off-box replication still being a manual step. |
| Observability | 7/10 | Six genuinely useful endpoints plus an alert foundation exist where none did; held back by process-local scope (no cross-replica aggregation) and the bounded/lower-bound nature of the storage-usage scan. |
| Security | 8/10 | No live vulnerability found across two audit passes; the one real gap found (rate-limiter bypass under scaling) is fixed. Held back from 9-10 by two still-open low-priority opportunistic items. |
| Scalability | 6/10 | Worker horizontal scaling is already sound and documented; render-node scaling was independently verified safe. `apps/api` scaling is *correctness-ready* (rate limiter fixed) but *infrastructure-blocked* (no load balancer in the compose stack yet) - the main reason this category isn't higher. |
| Reliability (pre-existing, reconfirmed) | 9/10 | Idempotency, atomic writes, checkpointing, graceful shutdown, and structured logging were already solid going into this initiative and were not regressed - reconfirmed via the worker-replacement runbook section, not re-implemented. |
| Documentation | 9/10 | Every mechanism shipped this initiative has a corresponding doc (`backup-restore.md`, `monitoring.md`, `alerting.md`, `operations-runbook.md`) plus this report - all cross-referenced rather than duplicated, and all reflect what was actually tested, not just designed. |

**Overall**: this initiative measurably improved the two categories the original audit flagged as
most urgent (DR, and the one live scalability-security bug) from a materially worse starting point,
without introducing new schema risk, new heavy infrastructure, or any regression to the correctness
work already in place. The remaining path to a 9+ is short and already itemized in §12, not open-ended.
