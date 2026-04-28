# Project Guide for Claude

## Where things live

- **Code repo:** `https://github.com/mikkel-kaj/boliganalyse-v2` (origin/main).
  The old repo at `mikkel-kaj/bolig-analyse-ai` is preserved for history but
  no longer the source of truth.
- **Deployment target:** self-hosted Supabase v1.26.04 + Caddy + a FastAPI
  service on a Hetzner CPX31 VPS at `178.104.213.102`. SSH alias:
  `ssh boliganalyse` (key: `~/.ssh/boliganalyse_hetzner`, user: `root`).
- **Public URLs:**
  - `https://supabase.dev.boliganalyse.ai` — Studio + Postgres APIs (admin only)
  - `https://api.dev.boliganalyse.ai` — FastAPI listing service (frontend
    talks ONLY to this hostname)
- **DB schema source of truth:** `supabase/migrations/*.sql` — currently a
  single baseline `20260428160000_app_schema_baseline.sql`. Apply via
  `deploy/scripts/apply-migrations.sh`.
- **API service:** `api/` (FastAPI + Python 3.12 + uv). Deployed via
  `deploy/scripts/deploy-api.sh boliganalyse` — rsyncs to
  `/opt/supabase-stack/api/` and rebuilds the container.

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
- `uv run pytest`: Tests (when written).

## Project structure

- **Frontend** (Vite + React 18 + TS + shadcn/ui + Tailwind + React Query):
  `src/`. Talks to the API via `src/integrations/api/client.ts`. No
  Supabase JS dependency. Live status updates over SSE via `EventSource`.
- **API** (FastAPI + Python 3.12, ~1500 LOC): `api/src/`. Long-running
  container; no wall-clock cap. Scrapes a listing via one of seven
  providers, parses structured data, runs the Claude tool-use loop with
  Danmarks Statistik tools, persists to `app.apartment_listings` via the
  service-role key.
- **DB:** Single `app` schema with `apartment_listings` and `feedback`
  tables. Anon/authenticated have zero permissions; only service_role
  (= the API server) reads and writes.
- **Deployment artifacts:** `deploy/`. `README.md` has setup-from-scratch.
  `docker-compose.app.yml` adds the `api` service to the upstream
  supabase compose. `Caddyfile.example` has the `api.<domain>` block
  with `flush_interval -1` for SSE.

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
- **DST tools default ON for the API.** The legacy edge function (which
  is now deleted) used to force them OFF because of wall-clock fragility.
  The long-running API has no such cap.
- **CORS:** `CORS_ORIGINS` env (comma-separated) gates which origins the
  API accepts. Add new frontend hostnames there.
- **SSE buffering:** Caddy MUST have `flush_interval -1` on the
  `api.<domain>` block. Without it, EventSource sees status updates
  batched at end-of-stream. See `deploy/Caddyfile.example`.
- **Sanitize before write:** the repository strips null bytes from text
  fields — Postgres rejects `\0` in `text` columns even though Python
  tolerates them.
- **Secrets** (anon key, service-role key, Postgres password,
  ANTHROPIC/FIRECRAWL keys) live in `/opt/supabase-stack/.env` on the
  server (mode `600`). Never commit. `.env*.local` and `api/.env*` are
  gitignored.

## Migrating from the old setup (notes for context)

If you're poking through git history: the old repo had a Deno edge
function at `supabase/functions/analyze-apartment/` and a `private`/`public`
schema split where the frontend used Supabase JS to read a mirror table
over Realtime. Phase 2 (April 2026) replaced all of that:
- Deno → FastAPI
- Edge runtime → long-running container
- Realtime subscriptions → SSE
- private/public split → single `app` schema, API-only access
- Old migrations squashed to one baseline

The state machine, status enum values, provider list, and Claude prompt
all transferred 1:1. The JSON shape returned by `/listings/{id}` matches
what the old `client_apartment_listings` row looked like, minus the
internal columns.
