# Backup &amp; restore

Before this existed, Postgres and object storage had **no backup at all** - `docker-compose.yml`/
`docker-compose.prod.yml` persisted both only via bare named volumes, so a bad migration,
`docker compose down -v`, or disk failure lost 100% of the data with no recovery path. This is
the fix: a small scheduler service (`ops/backup`) that periodically backs up both, verifies each
backup, prunes old ones, and exposes backup health via `GET /backups`.

## What's backed up, and how

| | Mechanism | Format |
|---|---|---|
| Postgres | `pg_dump -Fc` (custom format) | One `.dump` file per run, plus a `.sha256` sidecar |
| Object storage (MinIO/R2) | `mc mirror` (works against any S3-compatible endpoint - see `docker.md`) | A dated snapshot directory per run, plus a `manifest.sha256` |

Both run on the same schedule, from the same `backup` service (`ops/backup/Dockerfile`, based on
`postgres:16-alpine` so `pg_dump`/`pg_restore` exactly match the server image used everywhere else
in this stack - a version-mismatched `pg_dump`/`pg_restore` is a real, easy-to-hit restore-time
failure mode).

Object-storage snapshots are a full copy each run, not an incremental diff against the previous
snapshot - every snapshot directory is independently restorable with no dependency on any other
run, at the cost of re-copying every object each time. If the bucket grows large enough that this
becomes expensive, lower `BACKUP_INTERVAL_HOURS` rather than building incremental-snapshot logic.

## Configuration

Set in `.env` (see `.env.example`):

| Var | Default | Meaning |
|---|---|---|
| `BACKUP_INTERVAL_HOURS` | `24` | How often the scheduler runs both backups. Runs once immediately on container start too, not just on the first tick. |
| `BACKUP_RETENTION_DAYS` | `14` | Dumps/snapshots older than this are pruned after each successful run. |
| `BACKUP_STALE_AFTER_HOURS` | `48` (read by `apps/api`, not the backup service) | How long `GET /backups` tolerates no fresh successful backup before reporting `stale: true`. |

In `docker-compose.prod.yml`, the `backup` service runs unconditionally (`restart: unless-stopped`).
In `docker-compose.yml` (dev) it's gated behind a compose profile, since dev data doesn't need real
backups but the scripts are worth exercising locally:

```bash
docker compose --profile backup up backup
```

## Verifying backup health

`GET /backups` on `apps/api` (unauthenticated, same posture as `/health` - no video/user data, just
timestamps and sizes):

```json
{
  "postgres": { "status": "ok", "artifact": "/backups/postgres/speedora-20260101T000000Z.dump", "sizeBytes": 69820, "checkedAt": "2026-01-01T00:00:00Z", "ageHours": 2.1, "stale": false },
  "storage":  { "status": "ok", "artifact": "/backups/storage/20260101T000000Z", "sizeBytes": 388634985, "checkedAt": "2026-01-01T00:00:00Z", "ageHours": 2.1, "stale": false }
}
```

`stale: true` means either the last run failed, or it's older than `BACKUP_STALE_AFTER_HOURS` -
both are worth paging on (see `docs/alerting.md`'s `isBackupStale` condition). `status: "unknown"`
means the backup service has never completed a run at all (e.g. local dev without the `backup`
profile enabled) - not itself an error, but worth noticing in production.

This works because `apps/api` mounts the same `backup-status` volume the `backup` service writes
to, read-only (`BACKUP_STATUS_DIR=/status`) - `apps/api` never touches Postgres/storage credentials
for this, it only ever reads two small JSON files.

## Manually verifying a specific backup

```bash
# Postgres - cheap check (checksum + pg_restore --list, no database touched)
docker compose -f docker-compose.prod.yml run --rm --entrypoint /app/verify-postgres-backup.sh backup \
  /backups/postgres/speedora-<timestamp>.dump

# Postgres - full check (actually restores into whatever DATABASE_URL points at - use a scratch DB)
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL=postgresql://user:pass@postgres:5432/scratch_db \
  --entrypoint /app/verify-postgres-backup.sh backup /backups/postgres/speedora-<timestamp>.dump --full

# Object storage
docker compose -f docker-compose.prod.yml run --rm --entrypoint /app/verify-storage-backup.sh backup \
  /backups/storage/<timestamp>
```

## Restore procedure

Both restore scripts are destructive (they overwrite the target) and refuse to run without an
explicit `--yes`.

### Postgres

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL=postgresql://user:pass@postgres:5432/<target-db> \
  --entrypoint /app/restore-postgres.sh backup /backups/postgres/speedora-<timestamp>.dump --yes
```

This verifies the dump first, then runs `pg_restore --clean --if-exists --no-owner`. **The dump may
predate migrations applied since it was taken** - after restoring, run `prisma migrate status`
(`packages/database`) against the same `DATABASE_URL`, and `prisma migrate deploy` if it's behind,
before pointing `apps/api`/`apps/worker` at the restored database.

### Object storage

```bash
docker compose -f docker-compose.prod.yml run --rm \
  --entrypoint /app/restore-storage.sh backup /backups/storage/<timestamp> --yes
```

Mirrors the snapshot back into `STORAGE_BUCKET`, overwriting any object keys present in both.

Both restore scripts have been exercised end-to-end against a real dump/snapshot as part of
building this (restored into a scratch database and a scratch bucket, then verified the rows/objects
landed) - this is a tested procedure, not just a written-down guess.

## What this does NOT cover

Backups live in `backup-data`/`backup-status`, two named Docker volumes on the same host as
Postgres/MinIO/R2 credentials - a real improvement over no backup at all, but **not off-box
durability**. A host-level disaster (disk failure, host loss, an operator running
`docker volume rm` by mistake) can still take out the live data and its backups together. Until
this is automated, periodically copy `backup-data` to a second location (a second host, cloud
storage, anywhere physically separate) - `docker run --rm -v speedora-prod_backup-data:/from -v /mnt/offbox:/to alpine cp -a /from/. /to/` (or equivalent) is enough to start with. This is the one
piece of the backup story that's deliberately left as a documented manual step rather than
automated, since "where off-box" is an infrastructure decision this repo can't make for you.
