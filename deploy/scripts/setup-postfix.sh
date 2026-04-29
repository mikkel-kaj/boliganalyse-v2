#!/usr/bin/env bash
# Bootstrap inbound mail for inbox.boliganalyse.ai on the Hetzner box.
#
# This script is idempotent — re-running it is safe and only performs work
# that is missing (cert, symlinks, renewal cron). It does NOT bring the
# postfix container up; do that with the regular compose-up after this.
#
# Usage (run on the VPS):
#   sudo ./deploy/scripts/setup-postfix.sh
#
# Steps:
#   1. Print DNS records that must already exist at the registrar.
#   2. Acquire a Let's Encrypt cert for inbox.boliganalyse.ai via certbot
#      standalone HTTP-01. THIS REQUIRES PORT 80 — Caddy must be stopped
#      while certbot runs (the supabase Caddy binds 80 on the host).
#   3. Symlink fullchain.pem + privkey.pem into the bind-mount directory
#      that docker-compose.app.yml mounts into the postfix container.
#   4. Install a daily cron entry that re-issues the cert before expiry.
#   5. Print the smoke-test command for the operator.

set -euo pipefail

DOMAIN="${POSTFIX_DOMAIN:-inbox.boliganalyse.ai}"
PUBLIC_IP="${POSTFIX_IP:-178.104.213.102}"
STACK_DIR="${STACK_DIR:-/opt/supabase-stack}"
TLS_DIR="${POSTFIX_TLS_CERT_DIR:-${STACK_DIR}/postfix-tls}"
ENV_FILE="${STACK_DIR}/.env"
LE_LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
CRON_FILE="/etc/cron.d/boliganalyse-postfix-renew"

log() { printf '==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }

# ----------------------------------------------------------------------------
# 0. Sanity
# ----------------------------------------------------------------------------

if [[ "${EUID}" -ne 0 ]]; then
  warn "This script writes to /etc/letsencrypt and /etc/cron.d — re-run with sudo."
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  log "Found ${ENV_FILE} — operator should ensure INBOUND_EMAIL_SECRET is set."
else
  warn "${ENV_FILE} not found. Add INBOUND_EMAIL_SECRET there before bringing the postfix service up."
fi

# ----------------------------------------------------------------------------
# 1. DNS records (informational)
# ----------------------------------------------------------------------------

cat <<EOF

================================================================
DNS records that MUST exist at the registrar before continuing
(propagation can take minutes — verify with \`dig MX ${DOMAIN}\`):

  ${DOMAIN}.   A    ${PUBLIC_IP}
  ${DOMAIN}.   MX   10 ${DOMAIN}.

PTR (rDNS) record — set in the Hetzner Cloud Console (this script
cannot do it; it requires the cloud API + the server's metadata):

  ${PUBLIC_IP}  ->  ${DOMAIN}

Without the PTR, large mail providers (Gmail, Outlook) will silently
drop mail you send from this host. We are receive-only, so the impact
is just bounce messages from senders.
================================================================

EOF

read -r -p "Are the DNS records in place? Type 'yes' to continue: " confirm
if [[ "${confirm}" != "yes" ]]; then
  warn "DNS not confirmed — aborting. Re-run after records propagate."
  exit 1
fi

# ----------------------------------------------------------------------------
# 2. Certbot — Let's Encrypt for SMTP STARTTLS
# ----------------------------------------------------------------------------

if ! command -v certbot >/dev/null 2>&1; then
  log "Installing certbot via apt"
  apt-get update -qq
  apt-get install -y -qq certbot
fi

if [[ -f "${LE_LIVE_DIR}/fullchain.pem" ]]; then
  log "Certificate already present at ${LE_LIVE_DIR} — skipping issuance."
  log "(Run 'certbot renew' if you actually want to force a refresh.)"
else
  cat <<'NOTE'

================================================================
About to acquire the Let's Encrypt cert via HTTP-01.

The supabase-bundled Caddy container binds port 80 on the host, so
certbot --standalone will fail unless we stop Caddy first. Run these
commands in another shell, then come back and continue:

    cd /opt/supabase-stack
    docker compose -f docker-compose.yml \
                   -f docker-compose.caddy.yml \
                   -f docker-compose.app.yml stop caddy

After certbot exits, restart Caddy:

    docker compose -f docker-compose.yml \
                   -f docker-compose.caddy.yml \
                   -f docker-compose.app.yml start caddy

Alternatively, switch to DNS-01 (--dns-<provider>) if your registrar
supports it — that path doesn't need port 80.
================================================================

NOTE
  read -r -p "Has Caddy been stopped (or do you want to use DNS-01)? Type 'yes' to continue: " confirm
  if [[ "${confirm}" != "yes" ]]; then
    warn "Aborting before certbot to avoid clobbering port 80."
    exit 1
  fi

  log "Running certbot --standalone for ${DOMAIN}"
  certbot certonly \
    --standalone \
    --preferred-challenges http \
    --non-interactive \
    --agree-tos \
    --email "${LETSENCRYPT_EMAIL:-admin@boliganalyse.ai}" \
    -d "${DOMAIN}"
fi

# ----------------------------------------------------------------------------
# 3. Symlink cert files into the bind-mount directory
# ----------------------------------------------------------------------------

mkdir -p "${TLS_DIR}"
ln -sf "${LE_LIVE_DIR}/fullchain.pem" "${TLS_DIR}/fullchain.pem"
ln -sf "${LE_LIVE_DIR}/privkey.pem"   "${TLS_DIR}/privkey.pem"
log "Symlinked certs into ${TLS_DIR}"

# Make sure the postfix container (running as the postfix UID, ~100/101)
# can actually read the symlink targets. Let's Encrypt's privkey.pem is
# 0600 root by default — relax to 0640 + group-readable so the bind-mount
# is usable from inside the container.
chmod 0644 "${LE_LIVE_DIR}/fullchain.pem" 2>/dev/null || true
chmod 0640 "${LE_LIVE_DIR}/privkey.pem"   2>/dev/null || true

# ----------------------------------------------------------------------------
# 4. Renewal cron
# ----------------------------------------------------------------------------

if [[ ! -f "${CRON_FILE}" ]]; then
  log "Installing renewal cron at ${CRON_FILE}"
  cat >"${CRON_FILE}" <<EOF
# Renew the inbox.boliganalyse.ai cert daily; reload postfix on success.
# Caddy must be stopped for the HTTP-01 challenge — the deploy_hook below
# tries a soft reload first; if that's not possible the cron will fail
# loudly and the operator can re-run setup-postfix.sh manually.
0 3 * * * root certbot renew --quiet --deploy-hook 'docker exec supabase-stack-postfix-1 postfix reload || true'
EOF
  chmod 0644 "${CRON_FILE}"
else
  log "Renewal cron already installed at ${CRON_FILE}"
fi

# ----------------------------------------------------------------------------
# 5. Done — instructions
# ----------------------------------------------------------------------------

cat <<EOF

================================================================
Postfix bootstrap complete.

Bring up the service:

    cd ${STACK_DIR}
    docker compose -f docker-compose.yml \\
                   -f docker-compose.caddy.yml \\
                   -f docker-compose.app.yml \\
                   up -d postfix

Smoke test from a remote host (install swaks first):

    # swaks --to test@${DOMAIN} \\
    #       --server ${DOMAIN} \\
    #       --from sender@example.com \\
    #       --header 'Subject: hello' \\
    #       --body 'test'

Inspect logs:

    docker compose -f docker-compose.yml \\
                   -f docker-compose.caddy.yml \\
                   -f docker-compose.app.yml logs -f postfix
================================================================
EOF
