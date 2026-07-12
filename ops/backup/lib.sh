#!/bin/bash
# Shared helpers sourced by every script in this directory. Not meant to be
# run directly.

log() {
  # level, message - single-line and UTC-timestamped so container logs stay
  # greppable, matching the rest of the stack's "every stage traceable"
  # convention without pulling a JSON logger into a handful of shell scripts.
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2"
}

# Writes the small JSON status file apps/api's BackupsController reads (see
# apps/api/src/health/backups.controller.ts) to answer "when did we last
# back up successfully, and how big was it" without apps/api needing any
# direct access to Postgres/storage credentials or the backup volume itself
# beyond this one read-only status file.
write_status() {
  local file="$1" status="$2" artifact="$3" size_bytes="$4"
  local tmp="${file}.tmp"
  cat >"$tmp" <<JSON
{
  "status": "${status}",
  "artifact": "${artifact}",
  "sizeBytes": ${size_bytes:-0},
  "checkedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
  mv "$tmp" "$file"
}
