# Self-hosted deploy

This directory contains everything needed to run boliganalyse-ai on a server
you own (Hetzner, in our case). The stack is:

- **Self-hosted Supabase** (Postgres + GoTrue auth + PostgREST + Realtime +
  Storage + Edge Runtime + Studio), run via the upstream `supabase/supabase`
  Docker Compose
- **Caddy** in front of Supabase for TLS + a single public hostname
- **Frontend** (Vite/React) — built locally or in CI, served from anywhere
  (Netlify, GitHub Pages, or the same Hetzner box behind Caddy)

The edge function `analyze-apartment` runs inside Supabase's Edge Runtime
container, exactly as it does on Supabase Cloud — no code changes. The plan
is to migrate that function to a dedicated API in a later phase; for now we
just want parity with the old setup but on our infrastructure.

## Prerequisites on the Hetzner box

Ubuntu 24.04 LTS, public IP, DNS records pointing at it:

| Record | Purpose |
| --- | --- |
| `supabase.<your-domain>` | Supabase API + Studio (behind Caddy) |
| `app.<your-domain>` (optional) | Frontend, if you serve it from the box |

Install Docker + Compose plugin + git:

```bash
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin git
sudo usermod -aG docker $USER  # log out & back in
```

## 1. Clone the upstream Supabase repo

We do **not** vendor Supabase's compose file into this repo — it churns and
is large. We pin to a known-good tag instead.

```bash
cd /opt
sudo git clone --depth 1 --branch v1.24.09 https://github.com/supabase/supabase.git
sudo chown -R $USER:$USER /opt/supabase
cp -R /opt/supabase/docker /opt/supabase-stack
cd /opt/supabase-stack
```

> **Pinning:** `v1.24.09` is the tag that was current when this guide was
> written. Bump it deliberately, never with `latest`. After bumping, re-run
> the migrations + smoke-test before declaring it done.

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

(Or run it locally and paste the output into `.env`.)

## 3. Bring up Supabase

```bash
docker compose pull
docker compose up -d
docker compose ps   # everything should be "healthy"
```

The API is now at `http://<server-ip>:8000`. Put Caddy in front of it (see
`Caddyfile.example`) for TLS and a stable hostname.

## 4. Apply migrations

From your laptop, with the Supabase CLI installed (`brew install supabase/tap/supabase`):

```bash
cd /home/mikke/dev/boliganalyse-ai
export SELF_HOSTED_DB_URL="postgresql://postgres:<POSTGRES_PASSWORD>@supabase.<your-domain>:5432/postgres"
./deploy/scripts/apply-migrations.sh
```

The script runs `supabase db push --db-url "$SELF_HOSTED_DB_URL"` against the
migrations in `supabase/migrations/`.

> If port 5432 isn't exposed publicly (recommended), tunnel it:
> `ssh -L 5432:localhost:5432 user@hetzner` and use `localhost` in the URL.

## 5. Deploy the edge function

Self-hosted Supabase reads functions from `volumes/functions/<name>/` inside
the compose directory. The script syncs our function over and bounces the
edge runtime:

```bash
./deploy/scripts/deploy-function.sh user@hetzner
```

Set the function's secrets via the Edge Runtime container env in `.env`
(`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`). They're already
listed in `.env.example`.

## 6. Point the frontend at the new instance

Local `.env`:

```
VITE_SUPABASE_URL=https://supabase.<your-domain>
VITE_SUPABASE_ANON_KEY=<value from /opt/supabase-stack/.env ANON_KEY>
```

Build + deploy. If you want the frontend on the same box, see the
"Frontend on Hetzner" section below.

## 7. Smoke test

1. `curl https://supabase.<your-domain>/rest/v1/client_apartment_listings -H "apikey: $ANON_KEY"` → should return `[]`
2. Open the app, paste a listing URL, watch a row appear in
   `private.apartment_listings`, then mirror to
   `public.client_apartment_listings`, status transitioning over Realtime.
3. Submit feedback → row appears in `public.feedback`.

## Frontend on Hetzner (optional)

If you don't want to keep using Netlify, the simplest path is to build the
SPA and let Caddy serve the static files. See `Caddyfile.example` for the
`app.<domain>` block.

## What's intentionally NOT in this directory

- A vendored copy of Supabase's docker-compose. It's huge and changes
  often; pin a tag from upstream instead.
- Production-grade backup, monitoring, log aggregation. Add those once the
  app is actually serving traffic.
- The migration to a dedicated API. That's the next phase.
