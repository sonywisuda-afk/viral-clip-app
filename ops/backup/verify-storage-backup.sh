#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib.sh"

snapshot_dir="${1:?usage: verify-storage-backup.sh <snapshot-dir>}"

if [ ! -d "$snapshot_dir" ] || [ ! -f "$snapshot_dir/manifest.sha256" ]; then
  log error "no manifest found in $snapshot_dir"
  exit 1
fi

cd "$snapshot_dir"
if ! sha256sum -c manifest.sha256 --quiet; then
  log error "one or more objects in $snapshot_dir failed checksum verification"
  exit 1
fi

log info "verify ok: $snapshot_dir"
