# Boliganalyse.ai — Architecture

## Deployment topology

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hetzner CPX31 VPS — 178.104.213.102 — Ubuntu 24.04                 │
│                                                                     │
│  ┌────────┐    ┌─────────────────────────────────────────────────┐  │
│  │  Caddy │ →  │  Supabase stack (upstream v1.26.04 compose)     │  │
│  │  :443  │    │  ─ Postgres 15      ─ PostgREST                 │  │
│  └────────┘    │  ─ Auth (GoTrue)    ─ Storage                   │  │
│       ↑        │  ─ Studio           ─ Kong gateway              │  │
│       │        └─────────────────────────────────────────────────┘  │
│       │        ┌─────────────────────────────────────────────────┐  │
│       └─────►  │  api/  FastAPI on Python 3.12                   │  │
│                │  ─ Long-running, no wall-clock cap              │  │
│   TLS via      │  ─ Service-role-key access to Postgres          │  │
│   Let's        │  ─ Listing scrape + Claude analysis +           │  │
│   Encrypt      │    DST tool calls + SSE streaming               │  │
│                └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              ↑
   DNS (Cloudflare, DNS-only / no proxy):
     supabase.dev.boliganalyse.ai → Caddy → Kong (Postgres/Auth/Studio)
     api.dev.boliganalyse.ai      → Caddy → FastAPI :8001
     dev.boliganalyse.ai          → Caddy → SPA build (optional)

   Frontend (Vite/React)
   ─ Reads VITE_API_URL from env
   ─ Talks ONLY to api.dev.boliganalyse.ai — no Supabase JS, no anon key
   ─ Live status via SSE (EventSource) on /listings/{id}/events
```

The frontend has zero direct contact with Supabase. The API server is the
sole Postgres client; it holds the service-role key and decides what to
return. Anon and authenticated roles have no permissions on `app.*`.

Compose layering: `docker-compose.yml` (upstream)
+ `docker-compose.caddy.yml` (upstream TLS) + `docker-compose.app.yml`
(our `api` service + env passthrough — checked into `deploy/`).

## Code layout

```
api/                          FastAPI service (Python 3.12, uv)
  pyproject.toml + uv.lock    Pinned deps
  Dockerfile                  Multi-stage build, ~150 MB final image
  src/
    main.py                   App init, lifespan, router wiring
    config.py                 pydantic-settings env loader
    routes/
      listings.py             POST /listings, GET, list, SSE events
      feedback.py             POST /feedback
      schemas.py              Pydantic response models (public surface)
      dependencies.py         FastAPI deps for the repo singleton
    services/
      listing_processor.py    State-machine orchestrator
      ai_analyzer.py          Claude tool-use loop with MAX_TOOL_TURNS cap
      tool_registry.py        Registry for Claude-callable tools
      base_tool.py            Tool ABC + JSON-schema validation
      prompt.py               The big Danish analysis prompt
      tools/dst_api.py        Danmarks Statistik tools (4 of them)
    providers/
      base.py                 Provider ABC
      registry.py             Singleton, ordered chain
      boligsiden.py           Specialised, follows realtor redirect
      home.py                 home.dk
      danbolig.py             via Firecrawl, with markdown trim
      edc.py                  edc.dk via JSON-LD
      json_ld.py              Generic JSON-LD extractor
      firecrawl.py            Universal fallback via Firecrawl REST
      fallback.py             Last resort — body text only
    repositories/
      listing.py              Service-role async access to app.*
    types/
      status.py               AnalysisStatus enum
      models.py               HTMLParseResult, etc.
    utils/
      url.py, html.py, validation.py

src/                          Frontend (Vite + React + TypeScript)
  integrations/api/client.ts  Fetch + SSE client — no Supabase
  contexts/StatusContext.tsx  Pulls status via API + EventSource
  pages/, components/, lib/

supabase/migrations/          Single baseline:
  20260428160000_app_schema_baseline.sql

deploy/
  docker-compose.app.yml      Adds the api service to the supabase stack
  Caddyfile.example           SSE-friendly reverse proxy block
  scripts/
    apply-migrations.sh       Runs supabase db push against the live DB
    deploy-api.sh             Rsyncs api/ + rebuilds the api container
    generate-keys.mjs         Derives JWTs from JWT_SECRET
```

## Database schema

One schema, two tables, no mirror:

```
app.apartment_listings        Canonical row per listing
app.feedback                  User feedback (FK to apartment_listings)
```

Internal fields (`html_primary`, `html_redirect`, `text_primary`,
`text_redirect`, `error_message`, `normalized_url`) are written by the
processor for audit/debug, but are **never** serialized into API
responses. `routes/schemas.py:ListingResponse.from_row` is the single
projection point.

Permissions: `service_role` has `USAGE` on `app` and `ALL` on the
tables. `anon` and `authenticated` are explicitly revoked. RLS is
intentionally not enabled — when only one role can reach the data, RLS
is theatre.

## Status state machine

`AnalysisStatus` enum (api/src/types/status.py + lib/status on the
frontend) drives both DB writes and SSE events.

```
            ┌──────────────────────────────────────────────┐
            ▼                                              │
    pending → queued → fetching_html → parsing_data        │
                                            │              │
                  ┌─────────────────────────┘              │
                  ▼                                        │
        preparing_analysis  (only if redirect URL differs) │
                  │                                        │
                  ▼                                        │
        generating_insights → finalizing → completed       │
                                                           │
        any state → error / timeout / invalid_url          │
        (terminal — closes SSE stream)            ─────────┘
                                              re-analysis from error
                                              re-runs with status=queued
```

Listings already in a non-error terminal state are returned as-is
unless the request includes `force=true`.

## Live status delivery

`GET /listings/{id}/events` opens an SSE stream. The endpoint polls the
DB on a 500 ms cadence; on every observed status change it emits a
`status` event with the public listing projection. When the listing
hits a terminal state it emits a final `complete` or `error` event and
closes the stream. Caddy's `flush_interval -1` keeps events flushing
without batching.

The frontend's `StatusContext` opens the stream after an initial fetch
and closes it on unmount or when the listing is already terminal at
fetch time.

## Tool-use loop

`AIAnalyzerService._analyze_with_tools` drives a Claude messages.create
loop:

1. Send the prompt + tool definitions.
2. For every `tool_use` block, execute the matching tool and append a
   `tool_result` block (truncated to 6 KB to keep DST payloads bounded).
3. If turn count hits `MAX_TOOL_TURNS = 3`, send one final request
   *without* tools plus a forced "JSON only" instruction.
4. Walk the brace depth from the first `{` (skipping braces inside
   strings) to extract the JSON object regardless of fences or chat
   around it.

Re-enabling DST tools by default is safe now: the new server has no
wall-clock cap. The `ENABLE_DST_TOOLS` env var still flips them off
for debugging or DST outages.

## Front-end consumption

`apiClient` (`src/integrations/api/client.ts`) is the only path between
browser and server. It exposes:

- `startAnalysis({ url, force })` — POST /listings
- `getListing(id)` — GET /listings/{id}
- `listRecent(limit)` — GET /listings (recent completed)
- `submitFeedback(payload)` — POST /feedback
- `streamListingEvents(id, handlers)` — SSE wrapper, returns a
  `close()` function for cleanup

The `Listing` type is defined client-side and matches the
`ListingResponse` Pydantic model field-for-field.

## Operational notes

- All secrets live in `/opt/supabase-stack/.env` on the server. The
  `api` container reads `SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `FIRECRAWL_API_KEY`, plus `ANTHROPIC_MODEL`/`MAX_TOKENS` and
  `CORS_ORIGINS` overrides. See `deploy/.env.example`.
- The `api` service connects to Kong over the docker network
  (`http://kong:8000`) — no public TLS round-trip for internal calls.
- Caddy is the supabase compose's own container (mount:
  `/opt/supabase-stack/volumes/proxy/caddy/Caddyfile`), and reaches the
  api service via docker DNS at `http://api:8000`. The api container
  publishes no host port — only Caddy can reach it.
- Frontend hosting is still up to the user — Netlify with
  `VITE_API_URL=https://api.dev.boliganalyse.ai` is the simplest path;
  self-hosting behind the same Caddy is the alternative.
