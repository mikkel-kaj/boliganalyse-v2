#!/usr/bin/env bash
# Generate a self-signed TLS cert for the supabase-db postgres container.
#
# Run on the VPS once, before the first `docker compose up -d db` that
# uses the docker-compose.app.yml override (which switches the db service
# to ssl=on and bind-mounts ./postgres-tls into the container).
#
# Why a self-signed cert is fine: `supabase db push` is invoked over an
# SSH tunnel (ssh -L 5433:localhost:5433 boliganalyse — note port 5433,
# the supabase-db loopback; 5432 is the pooler), so the wire is already
# encrypted; the cert exists only so postgres answers "yes I speak TLS"
# during the handshake. Clients use sslmode=require, which does not
# validate the cert chain.
#
# Postgres refuses to start unless the key file is owned by the
# in-container postgres user (uid 105 / gid 106 in the supabase/postgres
# image) AND has mode 0600. We chown explicitly to those numeric ids so
# the script doesn't depend on a `postgres` user existing on the host.
#
# Idempotent: re-running with valid files in place is a no-op.
set -euo pipefail

TLS_DIR="/opt/supabase-stack/postgres-tls"
PG_UID=105
PG_GID=106

if [[ ! -d "${TLS_DIR}" ]]; then
  sudo mkdir -p "${TLS_DIR}"
fi

if [[ -s "${TLS_DIR}/server.crt" && -s "${TLS_DIR}/server.key" ]]; then
  echo "OK: cert + key already present at ${TLS_DIR}; skipping."
  exit 0
fi

echo "==> Generating self-signed cert in ${TLS_DIR}"
sudo openssl req -new -x509 \
  -days 3650 \
  -nodes \
  -subj "/CN=supabase-db" \
  -keyout "${TLS_DIR}/server.key" \
  -out "${TLS_DIR}/server.crt" >/dev/null 2>&1

sudo chown "${PG_UID}:${PG_GID}" "${TLS_DIR}/server.crt" "${TLS_DIR}/server.key"
sudo chmod 644 "${TLS_DIR}/server.crt"
sudo chmod 600 "${TLS_DIR}/server.key"

echo "OK: cert + key written to ${TLS_DIR}"
echo "    -> recreate the db service so it picks up ssl=on:"
echo "       cd /opt/supabase-stack && docker compose \\"
echo "         -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \\"
echo "         up -d --no-deps --force-recreate db"
