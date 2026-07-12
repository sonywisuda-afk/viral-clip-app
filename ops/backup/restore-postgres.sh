#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib.sh"

# Usage: restore-postgres.sh <dump-file> --yes
#
# Restores a pg_dump custom-format archive into the database DATABASE_URL
# points at. Destructive by design (--clean drops existing objects before
# recreating them), so this requires an explicit --yes to run at all -
# unlike backup-postgres.sh (read-only against the live DB), this can never
# fire from an accidental invocation.
dump_file="${1:?usage: restore-postgres.sh <dump-file> --yes}"
confirm="${2:-}"

if [ "$confirm" != "--yes" ]; then
  log error "refusing to restore without --yes (this DROPS existing objects in the target database)"
  echo "Usage: restore-postgres.sh <dump-file> --yes"
  exit 1
fi

: "${DATABASE_URL:?DATABASE_URL must point at the target database}"

if [ ! -f "$dump_file" ]; then
  log error "no such file: $dump_file"
  exit 1
fi

log info "verifying $dump_file before restoring"
"$DIR/verify-postgres-backup.sh" "$dump_file"

redacted="$(echo "$DATABASE_URL" | sed -E 's#//[^@]+@#//***@#')"
log info "restoring $dump_file into $redacted"
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" "$dump_file"

log info "restore complete"
log info "next: run 'prisma migrate status' (packages/database) against this DATABASE_URL - the dump may predate migrations applied since it was taken, in which case run 'prisma migrate deploy' before pointing apps/api/apps/worker at it"
