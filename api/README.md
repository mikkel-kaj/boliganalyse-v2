# Boliganalyse API

FastAPI service that drives the listing-analysis pipeline. Receives a URL
from the frontend, scrapes it via one of seven providers, ingests broker
PDFs (directly or via an email round-trip), runs the Claude tool-use loop
with the PDFs attached as document content blocks, and persists results
to `app.apartment_listings`.

## Code layout

```
src/
  main.py                  App init, lifespan, router wiring
  config.py                pydantic-settings env loader

  routes/
    listings.py            POST /listings, GET, list, SSE events
    documents.py           GET /listings/{id}/documents + proxied PDF download
    webhooks.py            POST /webhooks/inbound-email (Postfix → us)
    feedback.py            POST /feedback
    schemas.py             Pydantic response models — the public surface
    dependencies.py        FastAPI deps for repos + storage singletons

  services/
    listing_processor.py   State-machine orchestrator (both ingestion paths)
    ai_analyzer.py         Claude tool-use loop, JSON extractor,
                           analyze_with_documents() attaches PDFs as
                           document content blocks
    tool_registry.py       Registry for Claude-callable tools
    base_tool.py           Tool ABC + JSON-schema validation
    prompt.py              Danish prompt + with-documents variant
    tools/dst_api.py       Danmarks Statistik tools (4)

  providers/
    base.py                Provider ABC
    registry.py            Singleton, ordered chain
    boligsiden.py          + redirect-following to find realtor source
    home.py
    danbolig.py            via Firecrawl, with markdown trim
    edc.py                 via JSON-LD
    json_ld.py             Generic JSON-LD extractor
    firecrawl.py           Universal fallback via Firecrawl REST
    fallback.py            Last resort — body text only

  documents/                Documents subsystem
    mindworking.py         Public Mindworking GUID → PDF fetcher
    storage.py             Supabase Storage wrapper (`documents` bucket)
    pipeline.py            ingest_documents(): dedupe + upload + persist
    inbound.py             parse_inbound_email(): MIME → URL list
    extractors/
      danbolig.py          HTML → Mindworking GUIDs (Path A)
      home.py              HTML → shop_id + case_number (Path B)
    submitters/
      home.py              POST Home.dk's lead form to trigger email

  repositories/
    listing.py             Service-role async access to apartment_listings
    document.py            listing_documents repo (insert/list/get/dedupe)
    inbound_email.py       inbound_emails repo (audit trail)

  types/
    status.py              AnalysisStatus enum (incl. AWAITING_DOCUMENTS)
    models.py              HTMLParseResult, FetchedDocument, etc.

  utils/
    url.py, html.py, validation.py
```

## Local development

```bash
cd api
cp .env.example .env       # then fill in real values
uv sync                    # installs deps into api/.venv
uv run uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

`uv sync` is idempotent — re-run after changing `pyproject.toml`.

### Common commands

| Command | Notes |
| --- | --- |
| `uv run uvicorn src.main:app --reload` | Dev server with auto-reload |
| `uv run ruff check` | Lint |
| `uv run ruff check --fix` | Lint with auto-fix |
| `uv run ruff format` | Format |
| `uv add <pkg>` | Add a runtime dep (updates `pyproject.toml` + `uv.lock`) |
| `uv add --dev <pkg>` | Add a dev-only dep |
| `uv lock --upgrade` | Bump all locked deps to latest within constraints |

### Tests

The `tests/` folder is scaffolded but mostly empty. When adding tests,
use `pytest-asyncio` for async coroutines and `pytest-httpx` for
mocking outbound HTTP. Run with:

```bash
uv run pytest
```

## Configuration

All env vars are listed in `.env.example` with documentation. Notable
behavioural flags:

| Var | Default | What it controls |
| --- | --- | --- |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | Override to swap to a cheaper/faster model without code changes |
| `ANTHROPIC_MAX_TOKENS` | `16000` | Hard cap on Claude's output. Bumped from 8 K because PDF-aware analyses produce much longer JSON. |
| `ENABLE_DST_TOOLS` | `true` | Whether the Danmarks-Statistik tools are exposed to Claude. The current prompt no longer instructs DST usage, so `true` is mostly inert; setting `false` removes them from the request payload entirely |
| `CORS_ORIGINS` | `http://localhost:8080` | Comma-separated list of allowed origins for browser requests |
| `INBOUND_EMAIL_SECRET` | (none — required for inbound email) | Shared HMAC the postfix pipe sends as `X-Inbound-Secret`; the webhook verifies. Must match what postfix sees. Both sides read it from `/opt/supabase-stack/.env` on the server. |
| `INBOX_DOMAIN` | `inbox.dev.boliganalyse.ai` | The email domain we hand to brokers in the lead form. Per-listing local part `<listing_id>@<INBOX_DOMAIN>`. |
| `HOME_LEAD_NAME` / `_EMAIL` / `_PHONE` | dev defaults | Identity sent to Home.dk's lead form. Phone must be a valid Danish format. |

## How the analysis flows

1. `POST /listings` validates the URL (only DK real-estate domains
   allowed), creates a row, and kicks off a background asyncio task.
2. `ListingProcessorService.process_listing` walks the state machine:
   `pending → fetching_html → parsing_data → …`.
   - **Direct-document brokers** (e.g. Danbolig): documents are
     ingested inline. Pipeline continues straight into the analyser.
   - **Email-gated brokers** (e.g. Home.dk): the lead form is
     submitted, the listing transitions to `awaiting_documents`, and
     `process_listing` returns. The pipeline resumes from the
     `/webhooks/inbound-email` route once the broker emails the docs.
   - **No-document brokers** (most): pipeline goes straight into
     analysis with text only.
3. Each transition writes to the DB; the SSE endpoint at
   `GET /listings/{id}/events` polls the row every 500 ms and emits a
   `status` event on every observed change, plus a final
   `complete` / `error` event when the listing reaches a terminal state.
   `awaiting_documents` is **not** terminal — SSE keeps polling.
4. `AIAnalyzerService.analyze_with_documents()` runs Claude with the
   listing text and any downloaded PDFs as `{"type": "document"}`
   content blocks, capped at `MAX_TOOL_TURNS=3`. The last turn forces
   a JSON-only answer regardless of tool state. The brace-walking JSON
   extractor unwraps Claude's response even if it's fenced or wrapped
   in chat.

## Adding a realtor for documents

The documents subsystem has two ingestion paths. Pick whichever the
broker actually supports — sometimes both are possible (e.g. broker
exposes a public API but also has a lead form), in which case Path A
is much simpler and should be preferred.

### Path A — broker exposes PDFs in HTML or a public API

1. Add an extractor at
   `src/documents/extractors/<broker>.py`. Take the listing HTML (and
   the URL if needed); return a list of `(filename, url)` tuples or a
   broker-specific ref dataclass. Never raise — return `[]` on
   missing/malformed. Pattern: `extractors/danbolig.py`.
2. Wire it into `_maybe_ingest_provider_documents()` in
   `services/listing_processor.py`. Match on
   `provider.name == "<Broker>"` and call your extractor; pass the
   refs to `documents/pipeline.py:ingest_documents()`.
3. If the broker's PDFs aren't on Mindworking, add a fetcher next to
   `documents/mindworking.py` (same shape — return a `FetchedDocument`)
   and dispatch on host inside `ingest_documents`.
4. Tests:
   - Unit test the extractor with a captured HTML fixture.
   - End-to-end:
     `./deploy/scripts/smoke-test-documents.sh <listing-url>`.

### Path B — broker requires a lead form to email PDFs

1. **Metadata extractor** at
   `src/documents/extractors/<broker>.py` — pulls broker-specific
   identifiers (shop ID, case number, …) from the listing HTML.
   Pattern: `extractors/home.py`.
2. **Lead submitter** at
   `src/documents/submitters/<broker>.py` — POSTs the broker's lead
   API. Hard-code the broker's expected headers (User-Agent, Origin,
   Referer); these often matter more than the body. Identity comes
   from `Settings.build_<broker>_lead_identity()` (operator name,
   email, phone). The reply-to is
   `<listing_id>@<settings.inbox_domain>`. Pattern:
   `submitters/home.py`.
3. **Wire in** `_maybe_submit_<broker>_lead()` inside
   `services/listing_processor.py`, gated on
   `provider.name == "<Broker>"`. On success, set `email_lead_sent_at`
   and `status = AWAITING_DOCUMENTS`, return `True` so
   `process_listing()` halts.
4. **Whitelist the broker's sending domain** in
   `deploy/postfix/sender_access` (`OK`). Re-deploy postfix:
   `./deploy/scripts/deploy-postfix.sh boliganalyse`. Without this,
   postfix rejects the email at `RCPT TO`.
5. **Inbound parser**: if the broker's email body uses non-Mindworking
   URLs or attachment-only delivery, extend
   `documents/inbound.py:parse_inbound_email` — keep the existing
   patterns intact so other brokers keep working.
6. Tests:
   - Unit test the metadata extractor + submitter (use
     `httpx.MockTransport`).
   - Unit test the inbound parser with a captured `.eml`.
   - End-to-end:
     `./deploy/scripts/smoke-test-documents.sh <listing-url>` —
     real broker, real email, real Storage. ~30–90 s wall-clock.

### Common gotchas

- `email_lead_sent_at` is the gate that prevents re-submitting the
  lead on retries. `force=true` on `POST /listings` resets the row, so
  it WILL re-submit. Don't rely on broker idempotency.
- Mindworking URLs are case-insensitive; the path varies slightly per
  broker (`<broker>.mindworking.eu/api/Public/Documents/<guid>` is
  the most common). The fetcher trims/normalises — keep that.
- Postfix won't see the email if the broker uses an unwhitelisted
  sender domain. Watch `docker logs supabase-postfix-1` during the
  first end-to-end test — silent SMTP rejections are the most common
  failure.
- The api needs `INBOUND_EMAIL_SECRET` injected via compose env. If a
  refactor accidentally drops it from `services.api.environment` in
  `deploy/docker-compose.app.yml`, every webhook call returns 401 and
  postfix drops the message.

## Adding a new listing provider

1. Subclass `BaseProvider` in `src/providers/<site>.py`. Implement
   `name`, `can_handle`, `parse_html` (and optionally
   `extract_image_url` if site-specific).
2. Register it in `ProviderRegistry.__init__` in
   `src/providers/registry.py`. Order matters — specialised providers
   come before generic ones (Firecrawl, JSON-LD, Fallback).
3. Add the domain to `SUPPORTED_DOMAINS` in
   `src/utils/validation.py` AND in `src/utils/validators.ts` on the
   frontend (the two lists must stay in sync — both reject URLs before
   the request hits the analysis pipeline).

## Adding a new Claude tool

1. Subclass `BaseTool` in `src/services/tools/<area>.py`. Define a
   `definition` dict with `name`, `description`, and a JSON-schema
   `input_schema`. Implement `_execute_impl`.
2. Register it in `ToolRegistry.initialize_tools` in
   `src/services/tool_registry.py`, optionally gated behind a feature
   flag in `Settings`.
3. Update the prompt in `src/services/prompt.py` so Claude knows the
   tool exists and when to call it.
