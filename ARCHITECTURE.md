# Boliganalyse.ai — Architecture

## Deployment topology

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hetzner CPX31 VPS — 178.104.213.102 — Ubuntu 24.04                 │
│                                                                     │
│  ┌────────┐    ┌─────────────────────────────────────────────────┐  │
│  │  Caddy │ →  │  Supabase stack (upstream v1.26.04 compose)     │  │
│  │  :443  │    │  ─ Postgres 15 (ssl=on, host:5433)              │  │
│  └────────┘    │  ─ PostgREST   ─ Auth (GoTrue)                  │  │
│       ↑        │  ─ Storage     ─ Studio   ─ Kong gateway        │  │
│       │        └─────────────────────────────────────────────────┘  │
│       │        ┌─────────────────────────────────────────────────┐  │
│       ├─────►  │  api/  FastAPI on Python 3.12                   │  │
│       │        │  ─ Long-running, no wall-clock cap              │  │
│       │        │  ─ Service-role-key access to Postgres          │  │
│       │        │  ─ Listing scrape + document ingestion +        │  │
│       │        │    Claude tool-use loop + PDF document blocks   │  │
│       │        │  ─ SSE streaming on /listings/{id}/events       │  │
│       │        └─────────────────────────────────────────────────┘  │
│       │        ┌─────────────────────────────────────────────────┐  │
│   TLS │   port │  postfix/  Receive-only MTA                     │  │
│   via │     25 │  ─ Accepts mail at *@inbox.<domain>             │  │
│   LE  │ ◄────► │  ─ sender_access whitelist (broker domains)     │  │
│       │        │  ─ Pipes RFC822 → POST /webhooks/inbound-email  │  │
│       │        └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              ↑
   DNS (Cloudflare, DNS-only / no proxy):
     supabase.dev.boliganalyse.ai → Caddy → Kong (Postgres/Auth/Studio)
     api.dev.boliganalyse.ai      → Caddy → FastAPI :8000
     dev.boliganalyse.ai          → Caddy → SPA build (optional)
     inbox.dev.boliganalyse.ai    → Postfix :25 (DNS-only; A + MX + PTR)

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
(our overrides — checked into `deploy/`):

- `api` service definition (build from `./api`, env passthrough)
- `postfix` service definition (build from `./postfix`, port 25)
- `db` override turning on TLS + binding 127.0.0.1:5433 (the supabase
  CLI requires TLS; pooler owns 5432 and doesn't speak it)
- `caddy` mount of the SPA build directory

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
      ai_analyzer.py          Claude tool-use loop, analyze_with_documents
                              attaches PDFs as document content blocks
      tool_registry.py        Registry for Claude-callable tools
      base_tool.py            Tool ABC + JSON-schema validation
      prompt.py               Danish analysis prompt + with-documents variant
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
    documents/                Documents subsystem (see Documents pipeline)
      mindworking.py          Public Mindworking GUID → PDF fetcher
      storage.py              DocumentStorage wrapper over Supabase Storage
      pipeline.py             ingest_documents(): dedupe, upload, persist
      inbound.py              parse_inbound_email(): MIME → URLs
      extractors/
        danbolig.py           HTML → Mindworking GUIDs (direct path)
        home.py               HTML → shop_id + case_number (email-gated)
      submitters/
        home.py               POSTs Home.dk's lead form to trigger email
    repositories/
      listing.py              Service-role async access to apartment_listings
      document.py             listing_documents repo
      inbound_email.py        inbound_emails repo (email audit trail)
    routes/
      listings.py             POST/GET listings, SSE events
      documents.py            GET /listings/{id}/documents + proxied download
      webhooks.py             POST /webhooks/inbound-email (Postfix → us)
      feedback.py             POST /feedback
      schemas.py              Pydantic response models (public surface)
      dependencies.py         FastAPI deps for repos + storage singletons
    types/
      status.py               AnalysisStatus enum (incl. AWAITING_DOCUMENTS)
      models.py               HTMLParseResult, FetchedDocument, etc.
    utils/
      url.py, html.py, validation.py

deploy/postfix/               Receive-only Postfix container
  Dockerfile                  Debian-bookworm-slim + postfix + python3 + tini
  main.cf                     Receive config, sender_access whitelist,
                              maillog_file = /dev/stdout
  master.cf                   Trimmed services + the inbound-pipe transport
  virtual-regex               Catch-all: *@inbox.<domain> → inbound-pipe
  sender_access               Hash map of allowed broker domains
  inbound.py                  Pipe-transport target: stdin → POST webhook

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

One schema, four tables, no mirror:

```
app.apartment_listings        Canonical row per listing
app.feedback                  User feedback (FK to apartment_listings)
app.listing_documents         One row per stored PDF
                              (FK to apartment_listings, source enum,
                               sha256 dedupe, optional FK to inbound_emails)
app.inbound_emails            Audit trail for every Postfix-delivered email
                              (FK to apartment_listings via local_part match)
```

Internal fields on `apartment_listings` (`html_primary`, `html_redirect`,
`text_primary`, `text_redirect`, `error_message`, `normalized_url`,
`email_lead_sent_at`) are written by the processor for audit/debug, but
are **never** serialized into API responses.
`routes/schemas.py:ListingResponse.from_row` is the single projection
point. The repository's `get_for_resume()` is a separate select that
*does* include `html_primary`+`text_primary` — used only by the email-
resume code path, where the analyser needs the cached HTML to rebuild
its prompt.

Permissions: `service_role` has `USAGE` on `app` and `ALL` on the
tables. `anon` and `authenticated` are explicitly revoked. RLS is
intentionally not enabled — when only one role can reach the data, RLS
is theatre.

### Storage

A single private bucket `documents` holds the PDFs, keyed by
`{listing_id}/{sha256}.pdf`. The api proxies downloads through
`GET /listings/{id}/documents/{doc_id}` so the bucket can stay private
and the URL stays under `api.<domain>` — we never hand out signed URLs.

## Status state machine

`AnalysisStatus` enum (api/src/types/status.py + lib/status on the
frontend) drives both DB writes and SSE events.

```
    pending → queued → fetching_html → parsing_data
                                            │
                                            ▼
                              ┌─── Direct-path brokers ────┐
                              │  (Danbolig: PDFs in HTML)  │
                              │   ingest documents inline  │
                              └─────────────┬──────────────┘
                                            │
                          ┌─── OR ──────────┴─────────────┐
                          ▼                               ▼
                  Email-gated brokers            no documents needed
                  (Home.dk: lead form               (most listings)
                   → broker emails docs)                    │
                          │                                 │
                          ▼                                 │
              awaiting_documents ──────────────────►  preparing_analysis
              (postfix ▼ webhook                            │
               resumes)                                     ▼
                          │                          generating_insights
                          ▼                                 │
                  preparing_analysis                        ▼
                          │                              finalizing
                          ▼                                 │
                   generating_insights ─►  finalizing ──► completed

   any state → error / timeout / invalid_url
   (terminal — closes SSE stream; re-analysis from error
   re-runs with status=queued)
```

`awaiting_documents` is **not** terminal — the SSE stream stays open and
keeps polling. The pipeline resumes via
`POST /webhooks/inbound-email` calling
`ListingProcessorService.complete_with_documents()` once the broker email
arrives.

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

When `ListingProcessorService` calls
`AIAnalyzerService.analyze_with_documents(text, pdf_documents)`, every
loaded PDF is attached as a `{"type": "document"}` content block on the
initial user message. The prompt builder
(`build_analysis_prompt_with_documents`) then tells Claude that the PDFs
are the primary source for tilstand / el-installation / energimærke and
to cite them by page number in `excerpt` fields. Empty document list →
falls back to `analyze_text` (text-only) automatically. Output budget
defaults to `ANTHROPIC_MAX_TOKENS=16000` because the JSON gets
substantially longer once the model has the PDFs to work from.

## Documents pipeline

Two ingestion paths converge on the same Storage bucket and the same
analyser. Both are coordinated by `ListingProcessorService`.

### Path A — direct (Danbolig pattern)

Some brokers expose document IDs in the listing HTML. Danbolig embeds
them as a `'documents': [...]` Vue prop. We extract those IDs at scrape
time and fetch each PDF immediately.

```
process_listing()
    │
    ├─► provider.parse_html()         (extract listing text)
    │
    ├─► _maybe_ingest_provider_documents()
    │     └─► extractors/<broker>.py  (HTML → list of refs)
    │     └─► documents/pipeline.py:ingest_documents()
    │            ├─► mindworking.fetch_document(url)
    │            ├─► sha256 dedupe via DocumentRepository
    │            ├─► storage.upload(bucket, path, bytes)
    │            └─► repo.insert(NewListingDocument)
    │
    └─► continue to analysis with documents attached
```

### Path B — email-gated (Home.dk pattern)

Some brokers don't expose docs publicly. They want a phone+email lead
before sending sales material. We auto-submit their lead form with our
own identity and a per-listing inbox address; the broker emails the
docs ~30s later.

```
process_listing()
    │
    ├─► provider.parse_html()
    │
    ├─► _maybe_submit_home_lead()      (returns True if email-gated)
    │     ├─► extractors/<broker>.py     (HTML → metadata)
    │     ├─► submitters/<broker>.py     (POST broker lead API)
    │     └─► repo.set_email_lead_sent() (set email_lead_sent_at,
    │                                     status = AWAITING_DOCUMENTS)
    │
    └─► return early — pipeline halts here

… broker emails <listing_id>@inbox.<domain> ~30s later …

postfix smtpd
    │
    ├─► virtual-regex catch-all → inbound-pipe transport
    │
    └─► inbound.py: POST raw RFC822 → /webhooks/inbound-email
                   (Content-Type: message/rfc822, X-Inbound-Secret hdr)

routes/webhooks.py
    │
    ├─► verify X-Inbound-Secret == settings.inbound_email_secret
    ├─► documents/inbound.py:parse_inbound_email()
    │     ├─► local part of To: → listing_id
    │     └─► regex out *.mindworking.eu URLs from body (HTML decoded)
    ├─► persist app.inbound_emails row
    │
    └─► ListingProcessorService.complete_with_documents()
          ├─► ingest_documents() (same as Path A from here)
          ├─► reload listing.html_primary (via get_for_resume)
          ├─► analyze_with_documents()
          └─► save_analysis_result()
```

The shared trunk after either path:

- **Mindworking is a common backend.** Most Danish brokers run on
  `<broker>.mindworking.eu/api/Public/Documents/{guid}`. The fetcher
  validates the host suffix, caps at 30 MB, and returns a
  `FetchedDocument(content, filename, content_type, sha256)`.
- **Storage path** is `{listing_id}/{sha256}.pdf` in the `documents`
  bucket. Re-running an analysis with the same PDFs is a no-op upload.
- **At analyse-time**, `ListingProcessorService._load_pdf_documents`
  pulls every PDF row for the listing, downloads bytes from Storage,
  and feeds them to `analyze_with_documents`. A single download
  failure is logged and skipped — analysis continues with whatever
  PDFs are reachable.

### Adding a new realtor

Pick the path the broker actually supports. Provider parsing (the
listing text path) is independent of documents and lives under
`api/src/providers/` — see `api/README.md` for that recipe. The
documents pipeline is what's covered here.

**Path A — broker exposes PDFs in HTML / public API:**

1. Add an extractor at `api/src/documents/extractors/<broker>.py`. It
   takes the listing HTML (and optionally the URL) and returns a
   `list[DocumentRef]` (filename + Mindworking URL, or whatever the
   broker uses). Never raise — return `[]` on missing/malformed.
   Example: `extractors/danbolig.py`.
2. Wire it into `_maybe_ingest_provider_documents()` in
   `services/listing_processor.py`. Match on
   `provider.name == "<Broker>"` and call your extractor.
3. If the broker's docs aren't on Mindworking, add a fetcher next to
   `documents/mindworking.py` (same shape — return `FetchedDocument`)
   and dispatch on host inside `ingest_documents`.
4. Tests:
   - Unit test the extractor with a captured HTML fixture
   - End-to-end: pick a real listing URL and run
     `./deploy/scripts/smoke-test-documents.sh <url>`

**Path B — broker requires a lead form to email PDFs:**

1. Metadata extractor at
   `api/src/documents/extractors/<broker>.py` that pulls the broker's
   shop/case/listing identifiers out of the listing HTML.
2. Lead submitter at `api/src/documents/submitters/<broker>.py`. It
   takes the metadata + the per-listing inbox address
   (`<listing_id>@<settings.inbox_domain>`) + the operator identity
   from `Settings.build_<broker>_lead_identity()` and POSTs the
   broker's lead API. Hard-code the broker's expected headers
   (User-Agent, Origin, Referer) — these tend to matter.
3. Wire into `_maybe_submit_<broker>_lead()` in
   `services/listing_processor.py`, gated on `provider.name == "<Broker>"`.
   On success, set `email_lead_sent_at` and `status = AWAITING_DOCUMENTS`,
   return `True` to short-circuit `process_listing()`.
4. Add the broker's sending domain to
   `deploy/postfix/sender_access` (`OK`).
   Re-deploy postfix: `./deploy/scripts/deploy-postfix.sh boliganalyse`.
   Without this, postfix rejects the email at `RCPT TO`.
5. If the broker's emails arrive in a non-trivial format (e.g.
   attachments-only, non-Mindworking links), extend
   `documents/inbound.py:parse_inbound_email` to recognise the new
   shape — keep the existing patterns intact so other brokers keep
   working.
6. Tests:
   - Unit test the metadata extractor + submitter (mock httpx)
   - Unit test the inbound parser with a captured `.eml`
   - End-to-end: `./deploy/scripts/smoke-test-documents.sh <url>` —
     real broker, real email, real Storage. Allow ~30-90 s.

**Common gotchas:**

- The `email_lead_sent_at` column is the gate that prevents
  re-submitting the lead on retries. `force=true` on `POST /listings`
  resets the row, so it WILL re-submit. Don't rely on broker
  idempotency.
- Mindworking URLs are case-insensitive and the path varies slightly
  per broker (`.eu/api/Public/Documents/<guid>` is the most common).
  The fetcher trims/normalises — keep that.
- Postfix won't see the email if the broker uses an unwhitelisted
  sender domain; it'll be rejected silently at SMTP. Watch
  `docker logs supabase-postfix-1` during the first end-to-end test.

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

The documents UI is **not** built yet — listing the PDFs and rendering
the awaiting state (`Henter dokumenter (~30 sek)…`) are tracked as
follow-up frontend work. The backend endpoints exist:

- `GET /listings/{id}/documents` — list of documents for the listing
- `GET /listings/{id}/documents/{doc_id}` — proxied PDF download with
  RFC 5987 filename for Danish characters

Both are unauthenticated for now (matching the rest of the read API).

## Operational notes

- All secrets live in `/opt/supabase-stack/.env` on the server. The
  `api` container reads `SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `FIRECRAWL_API_KEY`, **`INBOUND_EMAIL_SECRET`**, plus
  `ANTHROPIC_MODEL` / `ANTHROPIC_MAX_TOKENS` and `CORS_ORIGINS`
  overrides. See `deploy/.env.example`.
- **`INBOUND_EMAIL_SECRET` must reach BOTH api and postfix.** Shared
  HMAC for `X-Inbound-Secret`. Both services pull it from the same
  `.env` via `docker-compose.app.yml`. Rotation needs both containers
  recreated together — there's a small drop-and-bounce window. See
  the runbook's "Rotate inbound email secret" appendix.
- The `api` service connects to Kong over the docker network
  (`http://kong:8000`) — no public TLS round-trip for internal calls.
- Caddy is the supabase compose's own container (mount:
  `/opt/supabase-stack/volumes/proxy/caddy/Caddyfile`), and reaches the
  api service via docker DNS at `http://api:8000`. The api container
  publishes no host port — only Caddy can reach it.
- **Postfix logs to stdout via `maillog_file = /dev/stdout` + a
  `postlog` service in master.cf**. The slim Debian image has no
  syslog daemon — without these, every postfix log line is dropped
  silently. Do not remove either side.
- **Postgres is bound to `127.0.0.1:5433` in `docker-compose.app.yml`**,
  with `ssl=on` and a self-signed cert. The supabase CLI insists on
  TLS, and host port `5432` is taken by `supabase-pooler` (which
  doesn't speak TLS). `apply-migrations.sh` tunnels to 5433.
- **Postfix renewal cron** lives at
  `/etc/cron.d/boliganalyse-postfix-renew`, runs daily at 03:00, and
  reloads postfix on successful renewal. Caddy needs to be stopped
  during initial issuance only — the renewal flow is non-disruptive.
- Frontend hosting is still up to the user — Netlify with
  `VITE_API_URL=https://api.dev.boliganalyse.ai` is the simplest path;
  self-hosting behind the same Caddy is the alternative.
