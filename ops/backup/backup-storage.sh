#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib.sh"

# Snapshots the STORAGE_BUCKET this deployment already uses (see
# packages/storage) into a dated, self-contained local directory via `mc
# mirror` - works against MinIO (dev) or R2 (prod) identically, since both
# are S3-compatible and packages/storage's own client is already generic
# over either. Each snapshot is a full copy rather than an incremental
# diff against the previous one: every snapshot directory is independently
# restorable with no dependency on any other run, at the cost of copying
# every object again each time. If the bucket grows large enough that this
# becomes expensive, prefer lowering backup frequency (BACKUP_INTERVAL_HOURS)
# over building incremental-snapshot logic here.

: "${STORAGE_ENDPOINT:?STORAGE_ENDPOINT must be set}"
: "${STORAGE_BUCKET:?STORAGE_BUCKET must be set}"
: "${STORAGE_ACCESS_KEY_ID:?STORAGE_ACCESS_KEY_ID must be set}"
: "${STORAGE_SECRET_ACCESS_KEY:?STORAGE_SECRET_ACCESS_KEY must be set}"

BACKUP_DIR="${BACKUP_DIR:-/backups}/storage"
STATUS_DIR="${STATUS_DIR:-/status}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
FORCE_PATH_STYLE="${STORAGE_FORCE_PATH_STYLE:-true}"

path_style="off"
if [ "$FORCE_PATH_STYLE" = "true" ]; then path_style="on"; fi
mc alias set speedora-source "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY_ID" "$STORAGE_SECRET_ACCESS_KEY" --path "$path_style" >/dev/null

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot_dir="$BACKUP_DIR/${timestamp}"
mkdir -p "$snapshot_dir"

log info "storage backup starting -> $snapshot_dir (source: speedora-source/${STORAGE_BUCKET})"

if ! mc mirror --quiet "speedora-source/${STORAGE_BUCKET}" "$snapshot_dir"; then
  log error "mc mirror failed"
  write_status "$STATUS_DIR/storage.json" "failed" "$snapshot_dir" 0
  exit 1
fi

size_bytes="$(du -sb "$snapshot_dir" 2>/dev/null | awk '{print $1}' || echo 0)"
object_count="$(find "$snapshot_dir" -type f | wc -l | tr -d ' ')"

# Manifest of relative-path -> sha256 for every object in this snapshot -
# verify-storage-backup.sh recomputes and diffs it, the role
# backup-postgres.sh's .sha256 sidecar plays for a single dump file.
(cd "$snapshot_dir" && find . -type f ! -name 'manifest.sha256' -exec sha256sum {} \; >manifest.sha256)

log info "storage backup ok: $snapshot_dir (${object_count} objects, ${size_bytes} bytes)"
write_status "$STATUS_DIR/storage.json" "ok" "$snapshot_dir" "$size_bytes"

# Retention - each snapshot is its own dated directory, so pruning is just
# removing whole directories older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime "+${RETENTION_DAYS}" -print |
  while read -r old; do
    rm -rf "$old"
    log info "retention: removed $old"
  done
