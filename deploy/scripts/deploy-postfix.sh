#!/usr/bin/env bash
# Sync deploy/postfix/ to the Hetzner box and rebuild the postfix container.
#
# Mirrors deploy-api.sh in style. Run after setup-postfix.sh has provisioned
# the TLS cert (the container's bind-mount points at the symlinks the setup
# script creates) and after INBOUND_EMAIL_SECRET is set in the server's .env.
#
# Usage:
#   ./deploy/scripts/deploy-postfix.sh boliganalyse
#   ./deploy/scripts/deploy-postfix.sh boliganalyse --dry-run
set -euo pipefail

DRY_RUN=0
SSH_TARGET=""

usage() {
  cat <<'EOF' >&2
Usage: deploy-postfix.sh <ssh-target> [--dry-run]
  e.g. deploy-postfix.sh boliganalyse
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      if [[ -n "${SSH_TARGET}" ]]; then
        echo "Unexpected positional argument: $1" >&2
        usage
        exit 1
      fi
      SSH_TARGET="$1"
      shift
      ;;
  esac
done

if [[ -z "${SSH_TARGET}" ]]; then
  usage
  exit 1
fi

REMOTE_DIR="/opt/supabase-stack"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] rsync -av --delete ${REPO_ROOT}/deploy/postfix/ ${SSH_TARGET}:${REMOTE_DIR}/postfix/"
  echo "[dry-run] ssh ${SSH_TARGET} 'cd ${REMOTE_DIR} && docker compose -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml up -d --build postfix'"
  echo "[dry-run] ssh ${SSH_TARGET} '... logs -f --tail=50 postfix'"
  exit 0
fi

# Recreating the postfix container drops port 25 for ~2-3s while the new
# container starts. Show a heads-up before doing it.
echo "About to rsync deploy/postfix/ and rebuild the postfix container."
echo "Press Ctrl-C in 5 seconds to abort"
sleep 5

echo "==> Rsyncing postfix/ to ${SSH_TARGET}:${REMOTE_DIR}/postfix/"
rsync -av --delete \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  "${REPO_ROOT}/deploy/postfix/" "${SSH_TARGET}:${REMOTE_DIR}/postfix/"

echo "==> Building + restarting postfix container"
ssh "${SSH_TARGET}" "cd ${REMOTE_DIR} && \
  docker compose \
    -f docker-compose.yml \
    -f docker-compose.caddy.yml \
    -f docker-compose.app.yml \
    up -d --build postfix"

echo "==> Tailing logs (Ctrl-C to exit)"
ssh "${SSH_TARGET}" "cd ${REMOTE_DIR} && \
  docker compose \
    -f docker-compose.yml \
    -f docker-compose.caddy.yml \
    -f docker-compose.app.yml \
    logs -f --tail=50 postfix"
