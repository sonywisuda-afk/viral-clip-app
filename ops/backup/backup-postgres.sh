#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib.sh"

# Dumps the database identified by DATABASE_URL in pg_restore's custom
# format (-Fc) - smaller than a plain-SQL dump and, more importantly, the
# only format verify-postgres-backup.sh can integrity-check cheaply (a
# custom-format archive carries a table-of-contents pg_restore can list
# without replaying the whole dump; a plain-SQL dump has none). Runs on a
# timer via entrypoint.sh; safe to invoke by hand too.

: "${DATABASE_URL:?DATABASE_URL must be set}"
BACKUP_DIR="${BACKUP_DIR:-/backups}/postgres"
STATUS_DIR="${STATUS_DIR:-/status}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR" "$STATUS_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="$BACKUP_DIR/speedora-${timestamp}.dump"
tmp_file="${dump_file}.tmp"

log info "postgres backup starting -> $dump_file"

if ! pg_dump "$DATABASE_URL" -Fc -f "$tmp_file"; then
  log error "pg_dump failed"
  rm -f "$tmp_file"
  write_status "$STATUS_DIR/postgres.json" "failed" "" 0
  exit 1
fi

# Atomic rename so a concurrent reader (verify/restore/the status check)
# never observes a partially-written dump - the same discipline
# apps/worker's execFfmpegAtomically already applies to rendered output.
mv "$tmp_file" "$dump_file"
size_bytes="$(wc -c <"$dump_file" | tr -d ' ')"
sha256sum "$dump_file" | awk '{print $1}' >"${dump_file}.sha256"

if ! "$DIR/verify-postgres-backup.sh" "$dump_file"; then
  write_status "$STATUS_DIR/postgres.json" "failed" "$dump_file" "$size_bytes"
  exit 1
fi

log info "postgres backup ok: $dump_file (${size_bytes} bytes)"
write_status "$STATUS_DIR/postgres.json" "ok" "$dump_file" "$size_bytes"

# Retention - delete dumps (and their .sha256 sidecars) older than
# RETENTION_DAYS. find's -mtime +N is whole-day granularity, matching how
# an operator actually thinks about "keep N days of backups".
find "$BACKUP_DIR" -maxdepth 1 -name 'speedora-*.dump' -mtime "+${RETENTION_DAYS}" -print -delete |
  while read -r old; do log info "retention: removed $old"; done
find "$BACKUP_DIR" -maxdepth 1 -name 'speedora-*.dump.sha256' -mtime "+${RETENTION_DAYS}" -delete
