# Boliganalyse.ai

AI-powered analysis of Danish property listings. Paste a URL from a major
Danish real-estate portal — boligsiden, home, edc, danbolig, estate,
nybolig — and the backend scrapes the listing, runs Claude over the text,
and streams back a structured analysis of risks, highlights, and
buyer-relevant questions.

## Stack

- **Frontend** — Vite + React 18 + TypeScript + shadcn/ui + Tailwind +
  React Query. Talks only to the API; live status updates via SSE
  (`EventSource`). No Supabase JS dependency.
- **API** — FastAPI on Python 3.12 + uv. Long-running container; runs the
  Claude tool-use loop without wall-clock pressure. Holds the
  service-role key; the only thing that touches Postgres.
- **Database** — Postgres (in the self-hosted Supabase stack). Single
  `app` schema. Anon roles have zero permissions.
- **Hosting** — Self-hosted Supabase v1.26.04 on a Hetzner CPX31 box
  (Ubuntu 24.04). Caddy fronts everything, including the SPA static
  files, all behind one box.

```
Browser ─► dev.boliganalyse.ai ─────► Caddy ─► /var/www/app  (SPA)
                                       │
        ─► api.dev.boliganalyse.ai ────┴► Caddy ─► api:8000 (FastAPI)
                                                      │
                                                      └► kong:8000 ─► Postgres
        ─► supabase.dev.boliganalyse.ai ─► Caddy ─► kong:8000 ─► Studio + REST
                                                          (admin only,
                                                           basic auth)
```

## Repository layout

```
api/                         FastAPI service
  src/                       Source — see api/README.md
  pyproject.toml + uv.lock   Pinned Python deps
  Dockerfile

src/                         Frontend SPA source
  integrations/api/client.ts API + SSE client (the only network surface)

supabase/migrations/         Single baseline migration for the `app` schema

deploy/
  README.md                  From-scratch setup + day-to-day operations
  docker-compose.app.yml     Compose overlay (api service + caddy frontend volume)
  Caddyfile.example          Reference for the api/dev caddy blocks
  scripts/
    apply-migrations.sh      supabase db push against the live DB
    deploy-api.sh            Rsync api/ + rebuild the container
    deploy-frontend.sh       Build SPA + rsync to the host volume
    generate-keys.mjs        Derive ANON/SERVICE_ROLE JWTs from JWT_SECRET

ARCHITECTURE.md              State machine, code layout, tool-use loop
CLAUDE.md                    Notes for AI agents working in this repo
```

## Quickstart (local development)

You need:

- **Node.js 20+** (`npm` ships with it)
- **Python 3.12** + **[uv](https://docs.astral.sh/uv/)** (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **SSH access** to the Hetzner box if you want to point at remote Supabase

### 1. Frontend

```bash
cd ~/dev/boliganalyse-ai
cp .env.example .env.local
# .env.local already says VITE_API_URL=http://localhost:8000 — leave as-is
# unless you want to point at the deployed API.
npm install
npm run dev          # http://localhost:8080
```

### 2. API

```bash
cd ~/dev/boliganalyse-ai/api
cp .env.example .env
# Fill in real values. Get SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
# FIRECRAWL_API_KEY from /opt/supabase-stack/.env on the Hetzner box, or
# from your password manager:
#   ssh boliganalyse 'sudo cat /opt/supabase-stack/.env'
uv sync              # creates api/.venv
uv run uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

The API reads `SUPABASE_URL` from `.env`. Default is the live
self-hosted instance — anything you do locally hits production data.

### 3. Smoke test

Open `http://localhost:8080`, paste a real listing URL from boligsiden /
home / edc / danbolig / estate / nybolig. Status flows live through SSE
within ~60-180s.

## Deploying

All three deploy commands are in `deploy/scripts/`. They assume your SSH
config has a `boliganalyse` alias for the Hetzner box (key in
`~/.ssh/boliganalyse_hetzner`, user `root`).

| Command | What it does |
| --- | --- |
| `./deploy/scripts/deploy-api.sh boliganalyse` | Rsyncs `api/` to the server and rebuilds the api container. ~2-3 min on first build, ~30s on rebuilds. |
| `./deploy/scripts/deploy-frontend.sh boliganalyse` | Builds the SPA with `VITE_API_URL=https://api.dev.boliganalyse.ai` inlined, rsyncs `dist/` to the volume Caddy serves. Picked up immediately, no reload. |
| `./deploy/scripts/apply-migrations.sh` | Runs `supabase db push` against the live DB. Tunnel port 5432 first via `ssh -L 5432:localhost:5432 boliganalyse`. |

See [deploy/README.md](deploy/README.md) for the from-scratch
provisioning guide and the operational runbook (adding env vars,
rotating keys, debugging failed analyses, etc.).

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- Status state machine and SSE delivery
- The Claude tool-use loop with `MAX_TOOL_TURNS`
- DB schema and the deliberate single-schema / service-role-only model
- Why we don't use Supabase JS in the browser anymore
