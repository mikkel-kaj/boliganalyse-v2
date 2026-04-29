# Boliganalyse API

FastAPI service that drives the listing-analysis pipeline. Receives a URL
from the frontend, scrapes it via one of seven providers, runs the Claude
tool-use loop, and persists results to `app.apartment_listings`.

## Code layout

```
src/
  main.py                  App init, lifespan, router wiring
  config.py                pydantic-settings env loader

  routes/
    listings.py            POST /listings, GET, list, SSE events
    feedback.py            POST /feedback
    schemas.py             Pydantic response models — the public surface
    dependencies.py        FastAPI deps for the repository singleton

  services/
    listing_processor.py   State-machine orchestrator
    ai_analyzer.py         Claude tool-use loop, JSON extractor
    tool_registry.py       Registry for Claude-callable tools
    base_tool.py           Tool ABC + JSON-schema validation
    prompt.py              The Danish analysis prompt
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

  repositories/
    listing.py             Service-role async access to app.*

  types/
    status.py              AnalysisStatus enum
    models.py              HTMLParseResult etc.

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
| `ANTHROPIC_MAX_TOKENS` | `8000` | Hard cap on Claude's output |
| `ENABLE_DST_TOOLS` | `true` | Whether the Danmarks-Statistik tools are exposed to Claude. The current prompt no longer instructs DST usage, so `true` is mostly inert; setting `false` removes them from the request payload entirely |
| `CORS_ORIGINS` | `http://localhost:8080` | Comma-separated list of allowed origins for browser requests |

## How the analysis flows

1. `POST /listings` validates the URL (only DK real-estate domains
   allowed), creates a row, and kicks off a background asyncio task.
2. `ListingProcessorService.process_listing` walks the state machine:
   `pending → fetching_html → parsing_data → preparing_analysis →
   generating_insights → finalizing → completed` (or `error` /
   `timeout` along the way).
3. Each transition writes to the DB; the SSE endpoint at
   `GET /listings/{id}/events` polls the row every 500 ms and emits a
   `status` event on every observed change, plus a final
   `complete` / `error` event when the listing reaches a terminal state.
4. The `AIAnalyzerService` runs Claude with the providers' parsed text
   and the tool registry, capped at `MAX_TOOL_TURNS=3`. The last turn
   forces a JSON-only answer regardless of tool state. The brace-walking
   JSON extractor unwraps Claude's response even if it's fenced or
   wrapped in chat.

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
