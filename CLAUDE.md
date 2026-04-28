# Project Guide for Claude

## Where things live

- **Code repo:** `https://github.com/mikkel-kaj/boliganalyse-v2` (origin/main).
  The old repo at `mikkel-kaj/bolig-analyse-ai` is preserved for history but
  no longer the source of truth.
- **Deployment target:** self-hosted Supabase v1.26.04 + Caddy on a Hetzner
  CPX31 VPS at `178.104.213.102`. SSH alias: `ssh boliganalyse`
  (key: `~/.ssh/boliganalyse_hetzner`, user: `root`).
- **Public Supabase URL:** `https://supabase.dev.boliganalyse.ai`. Studio
  is behind basic auth (DASHBOARD_USERNAME/PASSWORD in the server `.env`).
- **DB schema source of truth:** `supabase/migrations/*.sql`. Apply via
  `deploy/scripts/apply-migrations.sh` or by `docker cp` + psql inside the
  `supabase-db` container.
- **Edge function:** `supabase/functions/analyze-apartment/`. Deployed via
  `deploy/scripts/deploy-function.sh boliganalyse` — rsyncs to
  `/opt/supabase-stack/volumes/functions/analyze-apartment/` and bounces
  the edge runtime container.

## Build and Development Commands

- `npm run dev`: Start frontend dev server (Vite, listens on `:8080`).
  Requires `.env.local` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- `npm run build`: Production build.
- `npm run lint`: ESLint across the codebase.
- `deno test --allow-net --allow-env supabase/functions/analyze-apartment/src/tests/`:
  Edge function unit tests.

## Project structure

- **Frontend** (Vite + React 18 + TS + shadcn/ui + Tailwind + React Query):
  `src/`. Talks to Supabase via `@supabase/supabase-js` for both
  postgres queries (REST) and realtime subscriptions on
  `public.client_apartment_listings`.
- **Edge function** (Deno, runs in Supabase's edge-runtime container):
  `supabase/functions/analyze-apartment/`. Scrapes a listing, parses
  structured data, calls Claude for the analysis, writes back to
  `private.apartment_listings`. A trigger mirrors writes to
  `public.client_apartment_listings`, which is what the frontend reads.
- **Deployment artifacts:** `deploy/`. `README.md` is the from-scratch
  setup guide. `docker-compose.app.yml` is layered onto upstream's compose
  files (`-f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml`).

## Phase status

- **Phase 1 — done**: lift the cloud Supabase setup onto a self-hosted
  Hetzner box, no rewrite. Smoke-tested end-to-end with a real listing
  through Opus 4.7. All infrastructure is in place.
- **Phase 2 — planned**: replace the edge function with a dedicated API
  server (no rewrite of analysis logic, just relocate). The edge runtime's
  60-second wall-clock + 200K-token context + opaque limits made the
  agentic Claude loop fragile; a long-running server lifts those.
- **Phase 3 — planned by user**: full overhaul / redesign. Out of scope
  until phase 2 is shipped.

## Code Style Guidelines

- **TypeScript**: strict typing preferred but project has
  `strictNullChecks: false`.
- **Imports**: absolute via `@/` for `src/`.
- **Components**: React functional components with TS types.
- **Naming**: camelCase for variables/functions, PascalCase for
  components/types.

## Operational gotchas worth knowing

- **`ENABLE_DST_TOOLS=false`** by default in `deploy/docker-compose.app.yml`.
  The Danmarks-Statistik tool-calling chain was the #1 source of edge
  runtime timeouts. It's off in phase 1; revisit when the dedicated API
  exists.
- **Realtime publication** must include `public.client_apartment_listings`,
  not `private.apartment_listings`. There's a migration that ensures this
  (`20260428120000_fix_realtime_publication.sql`).
- **Migration `20250330183846`** had triggers defined before their
  functions — would fail on a fresh DB. Already fixed (function defs
  moved before trigger creates, `IF EXISTS` / `OR REPLACE` for
  idempotency).
- **Dashboard credentials, anon key, service-role key, postgres password,
  and the three app API keys (OPENAI/ANTHROPIC/FIRECRAWL)** all live in
  `/opt/supabase-stack/.env` on the server (mode `600`). Never commit
  this file — the `.env.local` and `*.local` patterns in `.gitignore`
  cover it locally.
- **Don't log into the server's Postgres directly** for routine reads
  unless needed; prefer Studio at `https://supabase.dev.boliganalyse.ai`
  with the dashboard creds.
- **Frontend hosting** is currently dev-only (local `npm run dev`).
  Deciding where production lives (Netlify with new env vars vs the
  Hetzner box behind Caddy) is a phase-2 task.

## Architecture details

See `ARCHITECTURE.md` for the status-management state machine, frontend
component layout, and the planned phase-2 dedicated-API design.
