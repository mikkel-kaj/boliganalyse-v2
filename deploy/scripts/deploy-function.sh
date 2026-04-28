#!/usr/bin/env bash
# Deploy the analyze-apartment edge function to the self-hosted Supabase
# stack on the Hetzner box.
#
# Self-hosted Supabase reads function code from
#   /opt/supabase-stack/volumes/functions/<name>/
# inside the upstream docker-compose. We rsync the function over and bounce
# the edge-runtime container so it picks up the new code.
#
# Usage:
#   ./deploy/scripts/deploy-function.sh user@hetzner [stack-dir]
#
# stack-dir defaults to /opt/supabase-stack.

set -euo pipefail

SSH_TARGET="${1:?usage: deploy-function.sh user@host [stack-dir]}"
STACK_DIR="${2:-/opt/supabase-stack}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FN_SRC="$REPO_ROOT/supabase/functions/analyze-apartment"
FN_DEST="$STACK_DIR/volumes/functions/analyze-apartment"

if [[ ! -d "$FN_SRC" ]]; then
  echo "Function source not found: $FN_SRC" >&2
  exit 1
fi

echo "Syncing $FN_SRC -> $SSH_TARGET:$FN_DEST"
ssh "$SSH_TARGET" "mkdir -p '$FN_DEST'"
rsync -az --delete \
  --exclude '.git' --exclude 'tests' --exclude 'deno.lock' \
  "$FN_SRC/" "$SSH_TARGET:$FN_DEST/"

echo "Restarting edge runtime container..."
ssh "$SSH_TARGET" "cd '$STACK_DIR' && docker compose restart functions"

echo "Done. Tail logs with:"
echo "  ssh $SSH_TARGET \"cd $STACK_DIR && docker compose logs -f functions\""
