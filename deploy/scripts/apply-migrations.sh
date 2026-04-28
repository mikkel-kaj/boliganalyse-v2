#!/usr/bin/env bash
# Apply supabase/migrations/*.sql to the self-hosted DB.
#
# Requires the Supabase CLI on PATH (`brew install supabase/tap/supabase`).
# The CLI's `db push` reads supabase/migrations and applies anything not yet
# present in the target's `supabase_migrations.schema_migrations` table.
#
# Set SELF_HOSTED_DB_URL in your shell before running, e.g.:
#   export SELF_HOSTED_DB_URL='postgresql://postgres:PWD@supabase.your-domain.example:5432/postgres'
#
# Recommended: don't expose 5432 publicly. Tunnel it instead:
#   ssh -L 5432:localhost:5432 user@hetzner
#   export SELF_HOSTED_DB_URL='postgresql://postgres:PWD@localhost:5432/postgres'

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
