#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib.sh"

INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
INTERVAL_SECONDS=$((INTERVAL_HOURS * 3600))

log info "backup scheduler starting - postgres + storage every ${INTERVAL_HOURS}h"

run_once() {
  # Each kind's failure is logged and reflected in its own status file (via
  # write_status inside the script) but never stops the other, and never
  # kills this loop - a bad night for one backup kind shouldn't take the
  # scheduler down with it.
  "$DIR/backup-postgres.sh" || log error "postgres backup run failed - see above"
  "$DIR/backup-storage.sh" || log error "storage backup run failed - see above"
}

# Runs immediately on container start, not just on the first interval tick,
# so a fresh deploy has a backup within minutes rather than waiting up to
# BACKUP_INTERVAL_HOURS for the first one.
while true; do
  run_once
  log info "sleeping ${INTERVAL_HOURS}h until next backup run"
  sleep "$INTERVAL_SECONDS"
done
