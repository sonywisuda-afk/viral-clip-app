#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/lib.sh"

# Usage: verify-postgres-backup.sh <dump-file> [--full]
#
# Default check is cheap and safe to run after every single backup: verify
# the checksum sidecar matches, then ask pg_restore to list the archive's
# table of contents (fails immediately on a truncated/corrupt file, without
# touching any database). --full goes further and actually restores into
# whatever DATABASE_URL points at - meant for a scratch database, exercised
# periodically (e.g. before trusting a backup for a real incident), not on
# every run, since it needs somewhere real to restore into and takes far
# longer.

dump_file="${1:?usage: verify-postgres-backup.sh <dump-file> [--full]}"

if [ ! -f "$dump_file" ]; then
  log error "no such file: $dump_file"
  exit 1
fi

if [ -f "${dump_file}.sha256" ]; then
  expected="$(cat "${dump_file}.sha256")"
  actual="$(sha256sum "$dump_file" | awk '{print $1}')"
  if [ "$expected" != "$actual" ]; then
    log error "checksum mismatch for $dump_file (expected $expected, got $actual)"
    exit 1
  fi
fi

if ! pg_restore --list "$dump_file" >/dev/null; then
  log error "pg_restore --list failed to read $dump_file - dump is likely corrupt or truncated"
  exit 1
fi

if [ "${2:-}" = "--full" ]; then
  : "${DATABASE_URL:?--full requires DATABASE_URL to point at a scratch database - it will be overwritten}"
  log info "full verification: restoring into scratch database from $dump_file"
  if ! pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" "$dump_file"; then
    log error "full restore into scratch database failed"
    exit 1
  fi
  log info "full verification ok"
fi

log info "verify ok: $dump_file"
