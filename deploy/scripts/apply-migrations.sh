#!/usr/bin/env bash
# Apply supabase/migrations/*.sql to the self-hosted DB.
#
# Requires the Supabase CLI on PATH (`brew install supabase/tap/supabase`).
# The CLI's `db push` reads supabase/migrations and applies anything not yet
# present in the target's `supabase_migrations.schema_migrations` table.
#
# Set SELF_HOSTED_DB_URL in your shell before running. Tunnel via SSH so
# nothing is exposed publicly, and target the db's loopback port 5433 on
# the VPS (NOT 5432 — that's supabase-pooler, which doesn't speak TLS):
#
#   ssh -fN -L 5433:localhost:5433 boliganalyse
#   export SELF_HOSTED_DB_URL='postgresql://postgres:PWD@localhost:5433/postgres?sslmode=require'
#
# The supabase-db postgres container has ssl=on (see docker-compose.app.yml
# + setup-postgres-tls.sh). The cert is self-signed, so use sslmode=require
# (not verify-full) — the SSH tunnel already protects the wire.

set -euo pipefail

if [[ -z "${SELF_HOSTED_DB_URL:-}" ]]; then
  echo "SELF_HOSTED_DB_URL is not set. See script header." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found on PATH." >&2
  echo "Install: https://supabase.com/docs/guides/cli/getting-started" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "Applying migrations from $REPO_ROOT/supabase/migrations/ to self-hosted DB..."
supabase db push --db-url "$SELF_HOSTED_DB_URL" --include-all

echo "Done."
