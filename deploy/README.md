# Self-hosted deploy

Everything needed to run boliganalyse-ai on a server you own (Hetzner, in
our case). The stack:

- **Self-hosted Supabase** (Postgres + GoTrue + PostgREST + Storage + Studio +
  Kong + analytics) via the upstream `supabase/supabase` Docker Compose
- **Caddy** (system-installed) in front of everything for TLS
- **FastAPI `api` service** — our own, layered onto the supabase compose.
  Holds the service-role key. Frontend talks only to this.
- **Frontend** (Vite/React) — built locally or in CI, served from anywhere
  (Netlify, GitHub Pages, or the same Hetzner box behind Caddy)

## Prerequisites on the Hetzner box

Ubuntu 24.04 LTS, public IP, DNS records pointing at it:

| Record | Purpose |
| --- | --- |
| `supabase.<your-domain>` | Supabase API + Studio (admin only) |
| `api.<your-domain>` | FastAPI listing service (frontend's only contact) |
| `app.<your-domain>` (optional) | Frontend, if you serve it from the box |

Install Docker + Compose plugin + git + Caddy:

```bash
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin git caddy
sudo usermod -aG docker $USER  # log out & back in
```

## 1. Clone the upstream Supabase repo

We do **not** vendor Supabase's compose into this repo — it churns and is
large. We pin to a known-good tag.

```bash
cd /opt
sudo git clone --depth 1 --branch v1.24.09 https://github.com/supabase/supabase.git
sudo chown -R $USER:$USER /opt/supabase
cp -R /opt/supabase/docker /opt/supabase-stack
cd /opt/supabase-stack
```

> **Pinning:** `v1.24.09` is the tag that was current when this guide was
> written. Bump it deliberately, never with `latest`.

## 2. Configure secrets

Copy `.env.example` from this repo onto the server:

```bash
scp deploy/.env.example user@hetzner:/opt/supabase-stack/.env
ssh user@hetzner
cd /opt/supabase-stack
nano .env  # fill in every value — see comments in the file
```

Generate the JWT-derived keys with the helper:

```bash
node /home/mikke/dev/boliganalyse-ai/deploy/scripts/generate-keys.mjs
```

(Run it locally and paste the output into `.env`.)

## 3. Drop the compose override + Caddyfile in place

```bash
scp deploy/docker-compose.app.yml user@hetzner:/opt/supabase-stack/
scp deploy/Caddyfile.example user@hetzner:/tmp/Caddyfile

ssh user@hetzner
sudo mv /tmp/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile  # replace your-domain.example with your actual hostnames
sudo systemctl reload caddy
```

DNS for both `supabase.<domain>` and `api.<domain>` must already point to
the box before reload — Caddy needs to satisfy ACME challenges on each.

## 4. Deploy the API service code

From your laptop, with the repo cloned:

```bash
./deploy/scripts/deploy-api.sh boliganalyse
```

The script rsyncs `api/` to `/opt/supabase-stack/api/`, then runs

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.caddy.yml \
  -f docker-compose.app.yml \
  up -d --build api
```

…and tails logs. The first build takes ~2-3 minutes (downloads the
Python base image + uv-resolved deps). Subsequent rebuilds are fast
thanks to layer caching.

## 5. Bring up the rest of Supabase

```bash
ssh boliganalyse
cd /opt/supabase-stack
docker compose pull
docker compose \
  -f docker-compose.yml \
  -f docker-compose.caddy.yml \
  -f docker-compose.app.yml \
  up -d
docker compose ps   # everything should be "healthy"
```

## 6. Apply migrations

From your laptop, with the Supabase CLI installed
(`brew install supabase/tap/supabase`):

```bash
cd /home/mikke/dev/boliganalyse-ai
export SELF_HOSTED_DB_URL="postgresql://postgres:<POSTGRES_PASSWORD>@supabase.<your-domain>:5432/postgres"
./deploy/scripts/apply-migrations.sh
```

The script runs `supabase db push --db-url "$SELF_HOSTED_DB_URL"` against
`supabase/migrations/`. Currently a single baseline migration that
sets up the `app` schema with `apartment_listings` and `feedback` tables.

> If port 5432 isn't exposed publicly (recommended), tunnel it:
> `ssh -L 5432:localhost:5432 boliganalyse` and use `localhost` in the
> URL.

## 7. Point the frontend at the new instance

Local `.env.local`:

```
VITE_API_URL=https://api.<your-domain>
```

Build + deploy. If you want the frontend on the same box, see the
"Frontend on Hetzner" section below.

## 8. Smoke test

1. `curl https://api.<your-domain>/health` → `{"status":"ok"}`
2. `curl https://api.<your-domain>/listings` → `[]` (no completed
   analyses yet)
3. Open the frontend, paste a listing URL from boligsiden/home/edc/
   danbolig/estate, watch the status flow `pending → fetching_html →
   parsing_data → generating_insights → finalizing → completed` over
   SSE within ~60-180s.
4. Submit feedback → row appears in `app.feedback`.

If the AI step fails, tail logs:

```bash
ssh boliganalyse "cd /opt/supabase-stack && docker compose \
  -f docker-compose.yml \
  -f docker-compose.caddy.yml \
  -f docker-compose.app.yml \
  logs -f --tail=100 api"
```

## Frontend on Hetzner (optional)

If you don't want Netlify, the simplest path is to build the SPA and let
Caddy serve the static files. See the commented `app.<domain>` block in
`Caddyfile.example`.

## What's intentionally NOT here

- A vendored copy of Supabase's docker-compose. It's huge and changes
  often; pin a tag from upstream instead.
- Production-grade backup, monitoring, log aggregation. Add those once
  the app is actually serving real traffic.
