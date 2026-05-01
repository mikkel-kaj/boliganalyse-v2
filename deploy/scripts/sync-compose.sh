#!/usr/bin/env bash
# Push deploy/docker-compose.app.yml to the VPS.
#
# The upstream supabase docker-compose.yml is shipped in their repo; we
# layer our overrides via deploy/docker-compose.app.yml (api, postfix,
# the db SSL override, and the frontend caddy mount). Until this script
# existed, that file was hand-copied to the VPS and drifted easily —
# this is the single deploy seam.
#
# Usage:
#   ./deploy/scripts/sync-compose.sh boliganalyse
#
# Does NOT recreate any containers. Run the relevant deploy-*.sh after
# this if you want services to pick up the change.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <ssh-target>" >&2
  echo "  e.g. $0 boliganalyse" >&2
  exit 1
fi

SSH_TARGET="$1"
REMOTE_DIR="/opt/supabase-stack"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "==> Rsyncing deploy/docker-compose.app.yml to ${SSH_TARGET}:${REMOTE_DIR}/"
rsync -av \
  "${REPO_ROOT}/deploy/docker-compose.app.yml" \
  "${SSH_TARGET}:${REMOTE_DIR}/docker-compose.app.yml"

echo "OK. Run the matching deploy-*.sh (or 'docker compose ... up -d')"
echo "to apply changes."
