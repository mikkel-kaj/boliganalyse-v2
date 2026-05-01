# Project Guide for Claude

## Where things live

- **Code repo:** `https://github.com/mikkel-kaj/boliganalyse-v2` (origin/main).
- **Deployment target:** self-hosted Supabase v1.26.04 + Caddy + a FastAPI
  service on a Hetzner CPX31 VPS at `178.104.213.102`. SSH alias:
  `ssh boliganalyse` (key: `~/.ssh/boliganalyse_hetzner`, user: `root`).
- **Public URLs:**
  - `https://supabase.dev.boliganalyse.ai` — Studio + Postgres APIs (admin only)
  - `https://api.dev.boliganalyse.ai` — FastAPI listing service (frontend
    talks ONLY to this hostname)
- **DB schema source of truth:** `supabase/migrations/*.sql`. Two files:
  the original `app_schema_baseline.sql`, then
  `listing_documents_and_inbound_emails.sql` for the documents pipeline.
  Apply via `deploy/scripts/apply-migrations.sh` (uses `supabase db push`,
  tunnels to port **5433** on the VPS — port 5432 is the pooler).
- **API service:** `api/` (FastAPI + Python 3.12 + uv). Deployed via
  `deploy/scripts/deploy-api.sh boliganalyse` — rsyncs to
  `/opt/supabase-stack/api/` and rebuilds the container.
- **Postfix service:** `deploy/postfix/` — receive-only MTA that pipes
  inbound broker mail to the api webhook. Deployed via
  `deploy/scripts/deploy-postfix.sh boliganalyse`. Listens on
  `inbox.<domain>:25`. See `deploy/RUNBOOK_DOCUMENTS.md` for first-time
  bring-up (DNS, PTR, Let's Encrypt cert).
- **Documents subsystem reference:** see ARCHITECTURE.md → "Documents
  pipeline". Adding a new realtor source for documents is documented in
  `api/README.md` → "Adding a realtor for documents".

## Build and Development Commands

### Frontend (`src/`)

- `npm run dev`: Vite dev server on `:8080`. Requires `.env.local` with
  `VITE_API_URL=http://localhost:8000` (or your remote API).
- `npm run build`: Production build.
- `npm run lint`: ESLint.

### API (`api/`)

- `uv sync`: Install Python dependencies (creates `api/.venv/`).
- `uv run uvicorn src.main:app --reload`: Local dev server on `:8000`.
  Requires `api/.env` with `SUPABASE_*`, `ANTHROPIC_API_KEY`,
  `FIRECRAWL_API_KEY` etc. (see `api/.env.example`).
- `uv run ruff check`: Lint.
- `uv run pytest`: Tests. The `tests/` folder is sparse but real
  (e.g. `test_migration_documents.py` spins up a testcontainers
  Postgres and runs the baseline + documents migrations).

## Project structure

- **Frontend** (Vite + React 18 + TS + shadcn/ui + Tailwind + React Query):
  `src/`. Talks to the API via `src/integrations/api/client.ts`. No
  Supabase JS dependency. Live status updates over SSE via `EventSource`.
- **API** (FastAPI + Python 3.12): `api/src/`. Long-running container; no
  wall-clock cap. Scrapes a listing via one of seven providers, parses
  structured data, optionally ingests broker PDFs (direct or via email
  round-trip), runs the Claude tool-use loop with the PDFs attached as
  document content blocks, persists to `app.apartment_listings` via the
  service-role key.
- **DB:** Single `app` schema with four tables — `apartment_listings`,
  `feedback`, `listing_documents`, `inbound_emails`. Anon/authenticated
  have zero permissions; only service_role (= the API server) reads
  and writes.
- **Storage:** A private `documents` bucket holds the broker PDFs the
  api downloads (energimærke, tilstandsrapport, elinstallationsrapport,
  …). Bootstrapped eagerly via `deploy/scripts/ensure-documents-bucket.sh`.
- **Deployment artifacts:** `deploy/`. `README.md` has from-scratch setup;
  `RUNBOOK_DOCUMENTS.md` has the documents-feature rollout.
  `docker-compose.app.yml` overlays our services (api, postfix,
  supabase-db SSL, frontend caddy mount) onto the upstream supabase
  compose. `Caddyfile.example` has the `api.<domain>` block with
  `flush_interval -1` for SSE.

## Architecture details

See `ARCHITECTURE.md` for topology, state machine, code layout, and the
tool-use loop semantics.

## Code Style Guidelines

### Python (`api/`)

- Python 3.12, type hints everywhere.
- `ruff` for lint/format (config in `pyproject.toml`).
- Use `httpx.AsyncClient` for HTTP — no `requests`.
- Use `selectolax` for HTML parsing — no `bs4`.

### TypeScript (`src/`)

- `strictNullChecks: false` (legacy — don't fight it for old code).
- Imports via `@/` alias to `src/`.
- React functional components with TS types.
- camelCase for variables/functions, PascalCase for components/types.

## Operational gotchas worth knowing

- **PostgREST schema exposure:** `PGRST_DB_SCHEMAS=public,graphql_public,app`
  on the server — without `app`, supabase-py can't reach the tables.
- **API service uses internal Kong URL:** inside the docker network,
  `SUPABASE_URL=http://kong:8000`. The public hostname is for
  external/admin access only.
- **DST tools default ON.** Toggle with `ENABLE_DST_TOOLS=false` if a
  DST outage is dragging analyses out; otherwise leave them on.
- **CORS:** `CORS_ORIGINS` env (comma-separated) gates which origins the
  API accepts. Add new frontend hostnames there.
- **SSE buffering:** Caddy MUST have `flush_interval -1` on the
  `api.<domain>` block. Without it, EventSource sees status updates
  batched at end-of-stream. See `deploy/Caddyfile.example`.
- **Sanitize before write:** the repository strips null bytes from text
  fields — Postgres rejects `\0` in `text` columns even though Python
  tolerates them.
- **Secrets** (anon key, service-role key, Postgres password,
  ANTHROPIC/FIRECRAWL keys, **`INBOUND_EMAIL_SECRET`**) live in
  `/opt/supabase-stack/.env` on the server (mode `600`). Never commit.
  `.env*.local` and `api/.env*` are gitignored.
- **`INBOUND_EMAIL_SECRET` must reach BOTH api and postfix.** It's a
  shared HMAC the postfix pipe script sends as `X-Inbound-Secret` and
  the webhook verifies. If only one side has it, every email returns
  401 and gets dropped silently. `docker-compose.app.yml` passes it to
  both services — keep it that way when adding new environment plumbing.
- **Postfix logs to stdout via `maillog_file = /dev/stdout`** + a
  `postlog` service in master.cf. Don't unset `maillog_file` — the slim
  Debian image has no syslog daemon, and removing it makes every postfix
  line vanish silently.
- **DB migrations need port 5433, not 5432.** The supabase-db container
  is bound to host loopback `5433` in `docker-compose.app.yml`; host
  port `5432` is taken by `supabase-pooler` which doesn't speak TLS.
  `apply-migrations.sh` uses `?sslmode=require` against `5433`.
- **Document downloads are proxied through the api**, not signed-URL
  redirects. `GET /listings/{id}/documents/{doc_id}` streams the PDF
  bytes from Storage so the bucket can stay private and the hostname
  stays `api.<domain>`.
