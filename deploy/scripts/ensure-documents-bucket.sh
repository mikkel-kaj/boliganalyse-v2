#!/usr/bin/env bash
# Ensure the private `documents` Storage bucket exists on the live Supabase.
#
# Phase 2 added DocumentStorage.ensure_bucket(), but it only runs lazily on
# the first upload — so the very first scrape after a fresh deploy can race
# the bucket-create. This script runs the same idempotent code eagerly,
# reusing the api container's supabase-py + service-role key.
#
# Two modes:
#
#   1. Remote (default) — given an SSH alias, exec the api container on the
#      VPS. The container already has supabase-py installed and reaches
#      Supabase via the internal kong URL. Credentials come from the
#      compose env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
#
#   2. Local (--local) — run from the operator's laptop using `uv run`
#      against the values in `api/.env`. Useful for hitting a remote
#      Supabase from outside (set SUPABASE_URL=https://supabase.dev.boliganalyse.ai
#      in api/.env).
#
# Usage:
#   ./deploy/scripts/ensure-documents-bucket.sh boliganalyse
#   ./deploy/scripts/ensure-documents-bucket.sh boliganalyse --dry-run
#   ./deploy/scripts/ensure-documents-bucket.sh --local
#   ./deploy/scripts/ensure-documents-bucket.sh --local --dry-run
#
# Exit codes:
#   0  bucket exists (already, or just created)
#   1  invocation / config error
#   2  bucket-ensure failed at runtime

set -euo pipefail

DRY_RUN=0
LOCAL=0
SSH_TARGET=""
REMOTE_DIR="/opt/supabase-stack"
BUCKET="documents"

usage() {
  cat <<'EOF' >&2
Usage:
  ensure-documents-bucket.sh <ssh-target> [--dry-run]
  ensure-documents-bucket.sh --local [--dry-run]

Options:
  --local      Run via `uv run` against api/.env on this machine.
  --dry-run    Print what would happen, don't contact Supabase.
  -h, --help   This message.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --local)
      LOCAL=1
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

if [[ "${LOCAL}" -eq 0 && -z "${SSH_TARGET}" ]]; then
  echo "Either an SSH target or --local is required." >&2
  usage
  exit 1
fi

if [[ "${LOCAL}" -eq 1 && -n "${SSH_TARGET}" ]]; then
  echo "--local conflicts with an SSH target." >&2
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Inline Python — kept here (not as a separate file under api/) so the script
# is self-contained and can be re-used as a one-shot. It calls the same
# DocumentStorage.ensure_bucket() that the api server uses, so behaviour can't
# drift.
read -r -d '' PYTHON_SNIPPET <<'PY' || true
import asyncio
import os
import sys

from supabase import acreate_client

from src.documents.storage import DocumentStorage


async def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.environ.get("DOCUMENTS_BUCKET", "documents")

    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set", file=sys.stderr)
        return 2

    client = await acreate_client(url, key)
    storage = DocumentStorage(client, bucket=bucket)
    await storage.ensure_bucket()
    print(f"OK: bucket {bucket!r} present at {url}")
    return 0


sys.exit(asyncio.run(main()))
PY

if [[ "${DRY_RUN}" -eq 1 ]]; then
  if [[ "${LOCAL}" -eq 1 ]]; then
    echo "[dry-run] cd ${REPO_ROOT}/api && uv run --env-file .env python -c '<inline ensure_bucket() snippet>'"
  else
    echo "[dry-run] ssh ${SSH_TARGET} 'docker exec -i supabase-stack-api-1 python -c <inline ensure_bucket() snippet>'"
    echo "[dry-run]   (uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the api container's compose env)"
  fi
  echo "[dry-run] target bucket: ${BUCKET} (private)"
  exit 0
fi

if [[ "${LOCAL}" -eq 1 ]]; then
  if [[ ! -f "${REPO_ROOT}/api/.env" ]]; then
    echo "Missing ${REPO_ROOT}/api/.env — copy api/.env.example and fill in." >&2
    exit 1
  fi
  if ! command -v uv >/dev/null 2>&1; then
    echo "uv not found on PATH; install from https://docs.astral.sh/uv/" >&2
    exit 1
  fi
  echo "==> Ensuring bucket '${BUCKET}' via local uv run"
  cd "${REPO_ROOT}/api"
  DOCUMENTS_BUCKET="${BUCKET}" uv run --env-file .env python -c "${PYTHON_SNIPPET}"
  exit $?
fi

# Remote mode: exec inside the api container. We could ssh + cat .env +
# pass values through, but reusing the container's already-injected env is
# both simpler and avoids exposing the service-role key to the operator's
# shell history.
echo "==> Ensuring bucket '${BUCKET}' via api container on ${SSH_TARGET}"

# Find the actual container name; the supabase compose project prefix can
# vary (`supabase-stack-` is the default, but operators sometimes rename).
CONTAINER_NAME=$(ssh "${SSH_TARGET}" \
  "cd ${REMOTE_DIR} && docker compose \
    -f docker-compose.yml \
    -f docker-compose.caddy.yml \
    -f docker-compose.app.yml \
    ps -q api" | tr -d '\r')

if [[ -z "${CONTAINER_NAME}" ]]; then
  echo "Could not resolve the api container ID on ${SSH_TARGET}." >&2
  echo "Is the stack running? Try: ssh ${SSH_TARGET} 'cd ${REMOTE_DIR} && docker compose ps'" >&2
  exit 1
fi

# Feed the multi-line python via stdin (NOT `python -c "$snippet"`) — ssh
# reconstructs the remote argv as a single string, so newlines inside a -c
# argument get re-parsed by the remote shell as command separators. Piping
# the snippet to `python -` over `docker exec -i` sidesteps that entirely.
# DOCUMENTS_BUCKET overrides just the bucket name; SUPABASE_URL +
# SUPABASE_SERVICE_ROLE_KEY come from the api container's compose env.
printf '%s\n' "${PYTHON_SNIPPET}" | ssh "${SSH_TARGET}" \
  docker exec -i -e "DOCUMENTS_BUCKET=${BUCKET}" "${CONTAINER_NAME}" \
  python -
