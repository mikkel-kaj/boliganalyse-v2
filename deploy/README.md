# Self-hosted deploy

This directory has everything needed to run boliganalyse-ai on a server
you own — currently a Hetzner CPX31 box, but nothing here is
Hetzner-specific.

The stack:

- **Self-hosted Supabase** (Postgres + GoTrue + PostgREST + Storage +
  Studio + Kong + analytics) via the upstream `supabase/supabase` Docker
  Compose
- **Caddy** (the supabase compose's own container) — TLS via Let's
  Encrypt + reverse proxy + static file serving for the SPA
- **FastAPI `api` service** — our own, layered onto the supabase compose.
  Holds the service-role key. The frontend talks only to this.
- **Frontend** (Vite/React) — built locally and rsynced to a host volume
  that the supabase Caddy serves.

The repo's `boliganalyse` SSH alias (`~/.ssh/config`) points at the
running box; the scripts and the rest of this guide assume it. Substitute
your own alias if you're on a different machine.

---

## Part 1 — Provisioning a new box from scratch

Skip to [Part 2](#part-2--operational-runbook) for day-to-day tasks
against the already-running box.

### Prerequisites

Ubuntu 24.04 LTS, public IP, DNS records pointing at it:

| Record | Purpose |
| --- | --- |
| `supabase.<your-domain>` | Supabase REST + Studio (admin only) |
| `api.<your-domain>` | FastAPI listing service |
| `dev.<your-domain>` | Frontend SPA |

Install Docker + Compose plugin + git (Caddy ships as part of the
upstream supabase compose — don't install a system Caddy):

```bash
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin git
sudo usermod -aG docker $USER  # log out & back in
```

### 1. Clone the upstream Supabase repo

We don't vendor Supabase's compose into this repo — it churns and is
large. We pin to a known-good tag.

```bash
cd /opt
sudo git clone --depth 1 --branch v1.24.09 https://github.com/supabase/supabase.git
sudo chown -R $USER:$USER /opt/supabase
cp -R /opt/supabase/docker /opt/supabase-stack
cd /opt/supabase-stack
```

> **Pinning:** `v1.24.09` is what was current when this guide was
> written. Bump deliberately — never `latest`.

### 2. Configure secrets

Copy `.env.example` from this repo onto the server, fill it in:

```bash
scp deploy/.env.example boliganalyse:/opt/supabase-stack/.env
ssh boliganalyse
cd /opt/supabase-stack
sudo chmod 600 .env
sudo nano .env  # fill in every value — see comments in the file
```

Generate the JWT-derived keys with the helper (run on your laptop;
paste the three values into `/opt/supabase-stack/.env`):

```bash
node deploy/scripts/generate-keys.mjs
```

### 3. Compose overlay + Caddy blocks + frontend volume

```bash
scp deploy/docker-compose.app.yml boliganalyse:/opt/supabase-stack/
ssh boliganalyse 'mkdir -p /opt/supabase-stack/volumes/frontend'
```

Append the `api.<domain>` and `dev.<domain>` blocks from
[Caddyfile.example](Caddyfile.example) into the live Caddyfile (don't
overwrite the upstream supabase block):

```bash
ssh boliganalyse
sudo nano /opt/supabase-stack/volumes/proxy/caddy/Caddyfile
# Append both blocks; replace `dev.boliganalyse.ai` etc with your hostnames.
```

DNS for all three subdomains must point at the box before the next
step, otherwise ACME-HTTP01 challenges fail.

### 4. Bring up the full stack

```bash
ssh boliganalyse
cd /opt/supabase-stack
docker compose pull
docker compose \
  -f docker-compose.yml \
  -f docker-compose.caddy.yml \
  -f docker-compose.app.yml \
  up -d
docker compose ps   # everything should be "healthy" or "Up"
```

Studio is reachable at `https://supabase.<domain>` (basic-auth gate via
`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`).

### 5. Apply migrations

From your laptop, with the Supabase CLI installed
(`brew install supabase/tap/supabase`) and an SSH tunnel to Postgres:

```bash
ssh -fN -L 5432:localhost:5432 boliganalyse
export SELF_HOSTED_DB_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres"
./deploy/scripts/apply-migrations.sh
```

A single baseline migration sets up the `app` schema with
`apartment_listings` and `feedback`.

### 6. Deploy the API + frontend

```bash
./deploy/scripts/deploy-api.sh boliganalyse
./deploy/scripts/deploy-frontend.sh boliganalyse
```

### 7. Smoke test

1. `curl https://api.<domain>/health` → `{"status":"ok"}`
2. `curl https://api.<domain>/listings` → `[]`
3. Open `https://dev.<domain>`, paste a listing URL from
   boligsiden/home/edc/danbolig/estate/nybolig, watch status flow
   `pending → fetching_html → parsing_data → generating_insights →
   finalizing → completed` over SSE within ~60-180s.
4. Submit feedback → row appears in `app.feedback` (check Studio).

---

## Part 2 — Operational runbook

Day-to-day tasks against the running box.

### Deploy a code change

```bash
# API change:
./deploy/scripts/deploy-api.sh boliganalyse

# Frontend change:
./deploy/scripts/deploy-frontend.sh boliganalyse

# DB schema change — add a new file under supabase/migrations/:
ssh -fN -L 5432:localhost:5432 boliganalyse
export SELF_HOSTED_DB_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres"
./deploy/scripts/apply-migrations.sh
```

The frontend deploy is essentially zero-downtime (file_server picks up
new files on the next request). The API deploy has ~5-10 s of downtime
while the container recreates.

### Add or update an environment variable

Two cases:

**Variable read by the API container** — set it in
`/opt/supabase-stack/.env` and recreate the api container:

```bash
ssh boliganalyse
sudo nano /opt/supabase-stack/.env   # edit / append
cd /opt/supabase-stack
docker compose \
  -f docker-compose.yml \
  -f docker-compose.caddy.yml \
  -f docker-compose.app.yml \
  up -d --no-deps api
```

If the variable is also referenced in `deploy/docker-compose.app.yml`
(under `services.api.environment:`), make sure to update that file in
the repo too (and `scp` it back) — otherwise the next deploy will
silently lose your change.

**Variable read by the frontend** (`VITE_*`) — change
`deploy/scripts/deploy-frontend.sh` (or pass via `VITE_API_URL=…`
inline) and re-run the deploy. Frontend env vars are inlined at build
time, so a rebuild is required.

### Rotate API keys

`ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, and any other third-party
secrets:

1. Get a new key from the provider's console.
2. Update `/opt/supabase-stack/.env` on the server.
3. Recreate the api container (see above).
4. Revoke the old key in the provider's console.

The Supabase JWTs (`ANON_KEY`, `SERVICE_ROLE_KEY`) are derived from
`JWT_SECRET`. To rotate them, re-run `generate-keys.mjs` with a fresh
secret, update all three values in `/opt/supabase-stack/.env`, and
recreate **the entire stack** (every service that holds the secret —
auth, kong, rest, realtime, storage, studio, api). The simplest way:

```bash
ssh boliganalyse
cd /opt/supabase-stack
docker compose \
  -f docker-compose.yml \
  -f docker-compose.caddy.yml \
  -f docker-compose.app.yml \
  up -d --force-recreate
```

### Read or write to the database

Studio (admin UI) is at `https://supabase.<domain>`, behind basic auth
(`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`). For ad-hoc SQL, use the
**SQL Editor** there.

For psql against the live DB:

```bash
ssh boliganalyse 'docker exec -it supabase-db psql -U postgres -d postgres'
```

### Check logs

```bash
# API logs
ssh boliganalyse 'cd /opt/supabase-stack && docker compose \
  -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \
  logs -f --tail=100 api'

# Caddy
ssh boliganalyse 'docker logs -f --tail=100 supabase-caddy'

# Postgres
ssh boliganalyse 'docker logs -f --tail=100 supabase-db'
```

### Restart a single service

```bash
ssh boliganalyse 'cd /opt/supabase-stack && docker compose \
  -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \
  restart <service>'
# Service names: api, caddy, kong, rest, db, auth, realtime, storage, studio, …
```

### Debug a failed analysis

1. Find the listing's row in Studio (`app.apartment_listings`). The
   internal `error_message` column has the Python exception trace
   (never exposed via the API).
2. Tail api logs (above) — every status transition is logged with the
   listing id, so grep for the id.
3. Common failure modes:
   - **403/404 on fetch** — listing was taken down or site bot-blocks
     scrapers. Try the URL in a browser; if it works there, the
     User-Agent in `listing_processor.py` may need refreshing.
   - **Claude `stop_reason != "end_turn"`** — likely hit
     `MAX_TOOL_TURNS=3` without producing JSON. The forced-final
     prompt usually fixes this; if not, the prompt may need a tighter
     "JSON only" instruction.
   - **`Invalid schema: app`** — `PGRST_DB_SCHEMAS` on the server
     doesn't include `app`. Fix the env var, recreate the `rest`
     container.
4. Re-run the analysis with `?force=true`:

```bash
curl -X POST https://api.<domain>/listings \
  -H 'Content-Type: application/json' \
  -d '{"url":"<original url>","force":true}'
```

### Bumping the upstream Supabase tag

Don't do this casually. Read the upstream changelog first. When ready:

```bash
ssh boliganalyse
cd /opt/supabase
git fetch --tags
git checkout v1.NN.MM   # the new tag
cp -R /opt/supabase/docker/* /opt/supabase-stack/   # preserve our .env + volumes
cd /opt/supabase-stack
docker compose pull
docker compose \
  -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \
  up -d
```

Then re-run the migrations and a full smoke-test. Keep a backup of
`/opt/supabase-stack/.env` and a `pg_dump` first.

---

## What's intentionally NOT here

- A vendored copy of Supabase's docker-compose. It's huge and changes
  often; pin a tag from upstream instead.
- Production-grade backup, monitoring, log aggregation. Add those once
  the app is actually serving real traffic.
- A staging environment. The dev box currently *is* the staging
  environment.
