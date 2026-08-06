#!/usr/bin/env bash
# Manual Postgres backup — plan B until scheduled dumps land in Phase 2.
#
# Railway's native volume backups are a Pro-plan feature, so on Hobby the only honest
# safety net is a dump we run ourselves:
#
#   ./scripts/backup-db.sh              # → backups/spidey-shelf-<timestamp>.dump
#   ./scripts/backup-db.sh /some/dir    # → /some/dir/spidey-shelf-<timestamp>.dump
#
# Restore with:  pg_restore --clean --if-exists -d "$DATABASE_URL" <file>
#
# Reads DATABASE_URL from the environment (or from .env) and never echoes it.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="${1:-$repo_root/backups}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$repo_root/.env" ]; then
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$repo_root/.env" | cut -d= -f2- | tr -d '"'"'"'')"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set — see docs/wiki/Environment.md." >&2
  exit 1
fi

mkdir -p "$out_dir"
target="$out_dir/spidey-shelf-$(date -u +%Y%m%dT%H%M%SZ).dump"

pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$target"

echo "backup written: $target"
