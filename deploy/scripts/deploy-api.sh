#!/usr/bin/env bash
# Sync the api/ source tree to the Hetzner box and rebuild the api container.
#
# Usage:
#   ./deploy/scripts/deploy-api.sh boliganalyse
# (where `boliganalyse` is the SSH alias from ~/.ssh/config)
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

echo "==> Rsyncing api/ to ${SSH_TARGET}:${REMOTE_DIR}/api/"
rsync -av --delete \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  --exclude='.ruff_cache' \
  --exclude='.env' \
  --exclude='.env.*' \
  "${REPO_ROOT}/api/" "${SSH_TARGET}:${REMOTE_DIR}/api/"

echo "==> Building + restarting api container"
ssh "${SSH_TARGET}" "cd ${REMOTE_DIR} && \
  docker compose \
    -f docker-compose.yml \
    -f docker-compose.caddy.yml \
    -f docker-compose.app.yml \
    up -d --build api"

echo "==> Tailing logs (Ctrl-C to exit)"
ssh "${SSH_TARGET}" "cd ${REMOTE_DIR} && \
  docker compose \
    -f docker-compose.yml \
    -f docker-compose.caddy.yml \
    -f docker-compose.app.yml \
    logs -f --tail=50 api"
