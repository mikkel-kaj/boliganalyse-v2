#!/usr/bin/env bash
# Build the SPA with the prod API URL inlined and rsync dist/ to the
# host-mounted volume that supabase-caddy serves at https://dev.<domain>.
#
# Usage:
#   ./deploy/scripts/deploy-frontend.sh boliganalyse
#   ./deploy/scripts/deploy-frontend.sh boliganalyse https://api.dev.boliganalyse.ai
#
# Caddy auto-reloads on file change is NOT enabled — but we don't need a
# reload for static-file changes; the file_server directive picks up new
# files immediately.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <ssh-target> [api-url]" >&2
  echo "  e.g. $0 boliganalyse" >&2
  exit 1
fi

SSH_TARGET="$1"
API_URL="${2:-https://api.dev.boliganalyse.ai}"
REMOTE_DIR="/opt/supabase-stack/volumes/frontend"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

echo "==> Building with VITE_API_URL=${API_URL}"
VITE_API_URL="${API_URL}" npm run build

echo ""
echo "==> Verifying API URL was inlined"
if ! grep -q "${API_URL}" dist/assets/*.js; then
  echo "ERROR: API URL not found in built bundle — build env may not have been picked up" >&2
  exit 1
fi

echo ""
echo "==> Rsyncing dist/ to ${SSH_TARGET}:${REMOTE_DIR}/"
rsync -av --delete dist/ "${SSH_TARGET}:${REMOTE_DIR}/"

echo ""
echo "==> Deployed. Visit https://dev.boliganalyse.ai/"
