# Boliganalyse.ai

AI-powered analysis of Danish property listings. Paste a URL from a major
Danish real-estate portal — boligsiden, home, edc, danbolig, estate,
nybolig — and the backend scrapes the listing, ingests the broker's
sales-material PDFs (tilstandsrapport, energimærke, elinstallationsrapport
— either directly or via an email round-trip on brokers that gate them),
runs Claude over the text **plus the PDFs as document content blocks**,
and streams back a structured analysis of risks, highlights, and
buyer-relevant questions citing concrete pages.

## Stack

- **Frontend** — Vite + React 18 + TypeScript + shadcn/ui + Tailwind +
  React Query. Talks only to the API; live status updates via SSE
  (`EventSource`). No Supabase JS dependency.
- **API** — FastAPI on Python 3.12 + uv. Long-running container; runs the
  Claude tool-use loop without wall-clock pressure. Holds the
  service-role key; the only thing that touches Postgres + Storage.
- **Database** — Postgres (in the self-hosted Supabase stack). Single
  `app` schema with `apartment_listings`, `feedback`, `listing_documents`,
  and `inbound_emails`. Anon roles have zero permissions.
- **Storage** — private `documents` bucket holding the sales-material
  PDFs. Always proxied via the api — never directly exposed.
- **Inbound mail** — Postfix container at `inbox.boliganalyse.ai`
  receiving broker emails (some brokers only deliver PDFs that way), pipes
  each accepted message to the api's `/webhooks/inbound-email`.
- **Hosting** — Self-hosted Supabase v1.26.04 on a Hetzner CPX31 box
  (Ubuntu 24.04). Caddy fronts everything, including the SPA static
  files, all behind one box.

```
Browser ─► dev.boliganalyse.ai ─────► Caddy ─► /var/www/app  (SPA)
                                       │
        ─► api.dev.boliganalyse.ai ────┴► Caddy ─► api:8000 (FastAPI)
                                                      │
                                                      └► kong:8000 ─► Postgres + Storage
        ─► supabase.dev.boliganalyse.ai ─► Caddy ─► kong:8000 ─► Studio + REST
                                                          (admin only,
                                                           basic auth)

Broker ─► inbox.boliganalyse.ai:25 ─► Postfix ─► api:8000/webhooks/inbound-email
        (SMTP, TLS via Let's Encrypt)         (in-network HMAC-secured)
```

## Repository layout

```
api/                         FastAPI service
  src/                       Source — see api/README.md
  pyproject.toml + uv.lock   Pinned Python deps
  Dockerfile

src/                         Frontend SPA source
  integrations/api/client.ts API + SSE client (the only network surface)

supabase/migrations/         Baseline migrations for the `app` schema
                             (app tables + listing_documents/inbound_emails)

deploy/
  README.md                  From-scratch setup + day-to-day operations
  RUNBOOK_DOCUMENTS.md       Bring the documents subsystem up step-by-step
  docker-compose.app.yml     Compose overlay (api + postfix + db SSL + caddy SPA)
  Caddyfile.example          Reference for the api/dev caddy blocks
  postfix/                   Inbound-mail container source
  scripts/
    apply-migrations.sh      supabase db push against the live DB (TLS, port 5433)
    deploy-api.sh            Rsync api/ + rebuild the container
    deploy-postfix.sh        Rsync postfix/ + rebuild the container
    deploy-frontend.sh       Build SPA + rsync to the host volume
    sync-compose.sh          Rsync just the compose overlay (no rebuild)
    setup-postgres-tls.sh    Self-signed cert for supabase-db (idempotent)
    setup-postfix.sh         Let's Encrypt cert + cron for inbox.<domain>
    ensure-documents-bucket.sh  Create the private Storage bucket
    smoke-test-documents.sh  End-to-end documents-pipeline assertion
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
within ~60-180s. For Home.dk listings the pipeline pauses at
`awaiting_documents` while the broker emails PDFs — that round-trip needs
the deployed Postfix container, so locally those listings stall there
unless you point at the live API.

## Deploying

All three deploy commands are in `deploy/scripts/`. They assume your SSH
config has a `boliganalyse` alias for the Hetzner box (key in
`~/.ssh/boliganalyse_hetzner`, user `root`).

| Command | What it does |
| --- | --- |
| `./deploy/scripts/deploy-api.sh boliganalyse` | Rsyncs `api/` to the server and rebuilds the api container. ~2-3 min on first build, ~30s on rebuilds. |
| `./deploy/scripts/deploy-frontend.sh boliganalyse` | Builds the SPA with `VITE_API_URL=https://api.dev.boliganalyse.ai` inlined, rsyncs `dist/` to the volume Caddy serves. Picked up immediately, no reload. |
| `./deploy/scripts/apply-migrations.sh` | Runs `supabase db push` against the live DB. Tunnel port 5433 first via `ssh -fN -L 5433:localhost:5433 boliganalyse` and set `SELF_HOSTED_DB_URL` with `?sslmode=require`. |
| `./deploy/scripts/deploy-postfix.sh boliganalyse` | Rsyncs `deploy/postfix/` and rebuilds the postfix container. Brief port-25 downtime during recreate. |

See [deploy/README.md](deploy/README.md) for the from-scratch
provisioning guide and the operational runbook (adding env vars,
rotating keys, debugging failed analyses, etc.). For the documents
subsystem specifically, [deploy/RUNBOOK_DOCUMENTS.md](deploy/RUNBOOK_DOCUMENTS.md)
is the step-by-step bring-up guide (postgres TLS, inbox DNS,
`INBOUND_EMAIL_SECRET`, postfix cert, Storage bucket, smoke test).

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for:
- Status state machine (including `awaiting_documents`) and SSE delivery
- The Claude tool-use loop with `MAX_TOOL_TURNS` and PDF document blocks
- The documents subsystem (direct vs email-gated paths) and how to add
  a new realtor source
- DB schema and the deliberate single-schema / service-role-only model
- Why we don't use Supabase JS in the browser anymore
