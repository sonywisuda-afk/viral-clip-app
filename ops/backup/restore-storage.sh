#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib.sh"

# Usage: restore-storage.sh <snapshot-dir> --yes
#
# Mirrors a snapshot directory (from backup-storage.sh) back into
# STORAGE_BUCKET. Destructive by design (overwrites live objects with the
# snapshot's versions), so - same as restore-postgres.sh - requires an
# explicit --yes.
snapshot_dir="${1:?usage: restore-storage.sh <snapshot-dir> --yes}"
confirm="${2:-}"

if [ "$confirm" != "--yes" ]; then
  log error "refusing to restore without --yes (this overwrites live objects in STORAGE_BUCKET)"
  exit 1
fi

: "${STORAGE_ENDPOINT:?}"
: "${STORAGE_BUCKET:?}"
: "${STORAGE_ACCESS_KEY_ID:?}"
: "${STORAGE_SECRET_ACCESS_KEY:?}"

log info "verifying snapshot before restoring"
"$DIR/verify-storage-backup.sh" "$snapshot_dir"

FORCE_PATH_STYLE="${STORAGE_FORCE_PATH_STYLE:-true}"
path_style="off"
if [ "$FORCE_PATH_STYLE" = "true" ]; then path_style="on"; fi
mc alias set speedora-target "$STORAGE_ENDPOINT" "$STORAGE_ACCESS_KEY_ID" "$STORAGE_SECRET_ACCESS_KEY" --path "$path_style" >/dev/null

log info "restoring $snapshot_dir -> speedora-target/${STORAGE_BUCKET}"
mc mirror --quiet "$snapshot_dir" "speedora-target/${STORAGE_BUCKET}" --exclude "manifest.sha256"

log info "storage restore complete"
