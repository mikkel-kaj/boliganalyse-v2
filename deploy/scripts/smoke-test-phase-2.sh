#!/usr/bin/env bash
# End-to-end smoke test for Phase 2: kick off an analysis against the live
# API, poll status, and assert that at least one document eventually appears.
#
# Designed for Home.dk listings — those drop the analysis at
# `awaiting_documents` until the broker emails sales material, which Postfix
# pipes back to the api webhook. The full happy path therefore exercises:
#   API → Claude → Home contact form → Postfix → API webhook → Storage.
#
# Run from the operator's laptop (NOT the VPS):
#   ./deploy/scripts/smoke-test-phase-2.sh https://home.dk/...
#   ./deploy/scripts/smoke-test-phase-2.sh https://home.dk/... --api-url https://api.dev.boliganalyse.ai
#   ./deploy/scripts/smoke-test-phase-2.sh https://home.dk/... --timeout 180
#   ./deploy/scripts/smoke-test-phase-2.sh https://home.dk/... --dry-run
#
# Exit codes:
#   0  documents appeared within the timeout
#   1  invocation error
#   2  the API returned an error or the listing entered a terminal error state
#   3  timed out before documents arrived

set -euo pipefail

API_URL="${BOLIGANALYSE_API_URL:-https://api.dev.boliganalyse.ai}"
TIMEOUT_SECONDS=180
POLL_INTERVAL_SECONDS=5
DRY_RUN=0
LISTING_URL=""

usage() {
  cat <<'EOF' >&2
Usage:
  smoke-test-phase-2.sh <listing-url> [--api-url URL] [--timeout SECS] [--dry-run]

Options:
  --api-url URL    Override the API base URL (default https://api.dev.boliganalyse.ai
                   or $BOLIGANALYSE_API_URL).
  --timeout SECS   Total wall-clock budget (default 180).
  --dry-run        Print the requests it would make and exit.
  -h, --help       This message.

The script polls every 5 seconds. Pass status transitions are logged to
stdout. The first listing-document seen is treated as a pass.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
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
      if [[ -n "${LISTING_URL}" ]]; then
        echo "Unexpected positional argument: $1" >&2
        usage
        exit 1
      fi
      LISTING_URL="$1"
      shift
      ;;
  esac
done

if [[ -z "${LISTING_URL}" ]]; then
  usage
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (used to parse API responses)" >&2
  exit 1
fi

# Strip trailing slash so request paths concat cleanly.
API_URL="${API_URL%/}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  cat <<EOF
[dry-run] Smoke test plan:
  1. POST ${API_URL}/listings  -d '{"url":"${LISTING_URL}","force":true}'
  2. Loop every ${POLL_INTERVAL_SECONDS}s up to ${TIMEOUT_SECONDS}s:
       GET ${API_URL}/listings/<id>          -> log status
       GET ${API_URL}/listings/<id>/documents -> count rows; pass on >= 1
  3. Pass if at least one document appears.
     Fail (exit 2) if status enters a terminal error state.
     Fail (exit 3) on timeout.
EOF
  exit 0
fi

log() { printf '[%(%H:%M:%S)T] %s\n' -1 "$*"; }
fail() { log "FAIL: $*"; exit "${2:-1}"; }

log "Smoke test: ${LISTING_URL}"
log "API base:   ${API_URL}"
log "Timeout:    ${TIMEOUT_SECONDS}s (poll every ${POLL_INTERVAL_SECONDS}s)"
echo

# 1. Kick off the analysis. force=true ensures we re-run even if the URL
#    was analysed previously — the smoke test should be deterministic from
#    a clean perspective each invocation.
START_BODY=$(jq -nc --arg url "${LISTING_URL}" '{url: $url, force: true}')
log "POST ${API_URL}/listings"
START_RESPONSE=$(curl -fsS -X POST "${API_URL}/listings" \
  -H 'Content-Type: application/json' \
  -d "${START_BODY}") || fail "POST /listings failed" 2

LISTING_ID=$(echo "${START_RESPONSE}" | jq -r '.listing.id // empty')
if [[ -z "${LISTING_ID}" ]]; then
  echo "${START_RESPONSE}" | jq . >&2 || true
  fail "Could not extract listing.id from POST response" 2
fi

log "Started listing ${LISTING_ID}"
echo

# 2. Poll. Track the last-seen status to keep the log noise down.
DEADLINE=$(( $(date +%s) + TIMEOUT_SECONDS ))
LAST_STATUS=""

# These statuses are terminal-with-failure; if we hit them, no point waiting.
TERMINAL_FAIL_STATUSES="error invalid_url timeout cancelled"

while [[ $(date +%s) -lt ${DEADLINE} ]]; do
  LISTING_JSON=$(curl -fsS "${API_URL}/listings/${LISTING_ID}") \
    || { log "GET /listings/${LISTING_ID} transient failure; retrying"; sleep "${POLL_INTERVAL_SECONDS}"; continue; }

  STATUS=$(echo "${LISTING_JSON}" | jq -r '.status // "unknown"')

  if [[ "${STATUS}" != "${LAST_STATUS}" ]]; then
    log "status: ${STATUS}"
    LAST_STATUS="${STATUS}"
  fi

  for terminal in ${TERMINAL_FAIL_STATUSES}; do
    if [[ "${STATUS}" == "${terminal}" ]]; then
      echo "${LISTING_JSON}" | jq . >&2 || true
      fail "listing entered terminal error status '${STATUS}'" 2
    fi
  done

  # The pass condition: at least one document. Documents arrive either
  # because the analyser pushed a PDF straight from the listing page, or
  # because Postfix delivered a broker email and the webhook stored its
  # attachments. Either way: >= 1 row here means success.
  DOCS_COUNT=$(curl -fsS "${API_URL}/listings/${LISTING_ID}/documents" | jq 'length' \
    || echo 0)

  if [[ "${DOCS_COUNT}" -ge 1 ]]; then
    log "PASS: ${DOCS_COUNT} document(s) attached to listing ${LISTING_ID}"
    log "  inspect:   ${API_URL}/listings/${LISTING_ID}/documents"
    exit 0
  fi

  sleep "${POLL_INTERVAL_SECONDS}"
done

fail "no documents arrived within ${TIMEOUT_SECONDS}s (final status: ${LAST_STATUS:-unknown})" 3
