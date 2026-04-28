# Handover — boliganalyse-ai overhaul

This file is the system prompt for the next agent picking up this project.
Paste everything below the line into the next session.

---

You are picking up the boliganalyse-ai overhaul from a previous agent.
Read this carefully before touching anything.

## What this project is

`boliganalyse.ai` is a Danish property-listing analysis app. A user pastes
a URL from a Danish real-estate site (nybolig.dk, home.dk, edc.dk,
danbolig.dk, estate.dk), and the backend scrapes the listing, calls
Claude to produce a structured JSON analysis, and streams status updates
to the frontend over Supabase Realtime.

Stack:

- **Frontend:** Vite + React 18 + TS + shadcn/ui + Tailwind + React Query.
  Source in `src/`. Talks to Supabase via `@supabase/supabase-js` for
  REST queries on `public.client_apartment_listings` + Realtime
  subscriptions on the same table + `supabase.functions.invoke` to kick
  off an analysis.
- **Edge function:** `supabase/functions/analyze-apartment/` (Deno,
  ~2000 LOC). Runs in Supabase's `supabase/edge-runtime:v1.71.2`
  container.
- **DB:** Postgres 15. Canonical writes go to `private.apartment_listings`;
  triggers mirror to `public.client_apartment_listings` for anon-readable
  realtime. `public.feedback` for user feedback.

## What was just done (phase 1, complete)

The previous agent migrated the app off Supabase Cloud and onto a
self-hosted Supabase v1.26.04 stack on a Hetzner CPX31 VPS. **No code
rewrite.** The goal was infrastructure parity, not architectural change.

Deliverables:

- `deploy/` folder: README, scripts, compose override, Caddyfile example
- `.env.example` (frontend) + `deploy/.env.example` (server)
- Frontend: removed hardcoded Supabase demo key fallback; now requires
  env vars at build time
- Two migration fixes (broken function-before-trigger ordering, wrong
  Realtime publication target)
- Edge function fixes to make Claude API calls actually work in 2026:
  - Model bumped to `claude-opus-4-7`, `max_tokens: 8000`
  - Removed deprecated `temperature` field and the
    `anthropic-beta: token-efficient-tools-2025-02-19` header
  - Fixed parallel `tool_use` handling (Claude 4.x emits more parallel
    calls than 3.7 did, the old single-tool loop was buggy)
  - Added `MAX_TOOL_TURNS = 3` cap with a forced JSON-only final answer
  - Truncated tool results to 6000 chars (DST API responses are huge)
  - Robust JSON extractor: code-fence stripping + brace-balance forward
    walk
  - `ENABLE_DST_TOOLS` feature flag, **default OFF** because the DST
    tool-calling chain was the primary cause of edge-runtime timeouts

End-to-end smoke test passed: a real nybolig.dk listing now produces a
complete analysis. Phase 1 is closed.

## Current operational state

- **Server:** Hetzner CPX31, IP `178.104.213.102`, hostname
  `ubuntu-8gb-fsn1-1`. Ubuntu 24.04, 4 vCPU AMD, 8 GB RAM, 75 GB disk.
- **SSH:** `ssh boliganalyse` (alias in `~/.ssh/config`, key
  `~/.ssh/boliganalyse_hetzner`, root user). Hetzner Cloud Firewall
  allows inbound 22/80/443 only — Postgres + Kong are not publicly
  reachable, tunnel via SSH if you need them.
- **Public URL:** `https://supabase.dev.boliganalyse.ai` (DNS-only, not
  Cloudflare-proxied; do not turn on the orange cloud without testing
  Caddy's Let's Encrypt renewal first).
- **Server config:** all secrets in `/opt/supabase-stack/.env` (mode 600,
  root-owned). Compose layered as
  `docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml`.
  Edge function code at `/opt/supabase-stack/volumes/functions/analyze-apartment/`.
- **Repo:** `https://github.com/mikkel-kaj/boliganalyse-v2`. The old repo
  `mikkel-kaj/bolig-analyse-ai` exists but is no longer pushed to.

## Things you must not do

- **Don't add more plasters to the edge runtime.** Phase 1 fragility was
  the symptom of a deeper architectural mismatch. The user explicitly
  said they want off edge functions, and phase 2 is the right fix.
  Resist the temptation to "just bump one more limit."
- **Don't push real secrets to the new repo.** The old repo had a real
  Anthropic key committed in `supabase/functions/analyze-apartment/src/tests/.env`
  — git history was scrubbed of all `.env` files via `git filter-branch`
  before the v2 push. If you encounter a similar leak, scrub it the same
  way (don't use GitHub's "unblock secret" URL).
- **Don't run unconditional `DELETE` on `private.apartment_listings` or
  `public.client_apartment_listings`.** Past sessions have stuck rows
  during dev — always delete by specific `id`, never wholesale.
- **Don't delete the old repo (`mikkel-kaj/bolig-analyse-ai`).** User
  said keep it for backup.
- **Don't proxy DNS through Cloudflare.** Caddy issues Let's Encrypt
  certs via HTTP-01; an orange-cloud record breaks the challenge.

## Things you should do (in order)

### 1. Phase 2: dedicated API server

Move `analyze-apartment` out of the edge runtime into a long-running
container on the same Hetzner box. The user wants this. The architecture
is sketched in `ARCHITECTURE.md` — a `Hono on Bun` (or equivalent —
discuss with user) service behind Caddy at `api.dev.boliganalyse.ai`,
talking to Supabase via the service-role key. Frontend swaps
`supabase.functions.invoke` for a plain `fetch` against the new endpoint.
Realtime, RLS, DB layout, status state machine — all unchanged.

Approximate plan:

1. Decide language/runtime with user (Hono+Bun, Hono+Node, FastAPI, etc.).
2. Scaffold `api/` directory at repo root with the chosen stack.
3. Port `supabase/functions/analyze-apartment/src/` mostly 1:1 — the
   service classes (ListingProcessorService, AIAnalyzerService,
   ToolRegistryService, providers, repositories) all transfer.
   Replace `Deno.env.get` with the runtime equivalent.
4. Add a `docker-compose.app.yml` service for the API container.
5. Add a Caddy block for `api.dev.boliganalyse.ai` (DNS A record for
   that hostname will need to be added at Cloudflare too — DNS only,
   grey cloud).
6. Frontend: change `src/pages/HomePage.tsx:73` to `fetch` the new
   endpoint instead of `supabase.functions.invoke`.
7. With phase 2 in place, **re-enable DST tools** (`ENABLE_DST_TOOLS=true`)
   — the new server has no wall-clock cap, so the original DST-driven
   analysis design is viable again.
8. Decide whether the edge function stays as a fallback or gets deleted
   entirely (recommend delete after phase 2 ships and is verified).

### 2. Frontend hosting decision

Frontend currently runs locally only (`npm run dev`). Production needs:

- Either Netlify (or similar) pointed at the new env vars
  (`VITE_SUPABASE_URL=https://supabase.dev.boliganalyse.ai`), or
- Self-hosted on the same Hetzner box behind Caddy at
  `dev.boliganalyse.ai` (Caddyfile.example has a commented block ready)

Discuss with user. Simpler is staying on Netlify for testing, then
deciding at production cutover.

### 3. Recommended cleanup before phase 3

- Add a CI workflow (lint + typecheck + edge function tests). The
  upstream supabase compose pulls a lot of images on first deploy;
  cache them in CI if you add it.
- Move the hardcoded Claude model name out of `config.ts` into env
  (`ANTHROPIC_MODEL`) so future model swaps don't require redeploy.
- The status-row mismatch flow (where index.ts short-circuits on
  non-error status) caused real friction during phase 1 testing.
  Consider a `?force=true` query param or admin endpoint to re-run
  without DB surgery.
- Rotate the API keys (OpenAI, Anthropic, Firecrawl) at next sensible
  pause — they were pasted into the previous chat transcript. Anthropic
  console: https://console.anthropic.com/settings/keys.

### 4. Phase 3 — full overhaul

User has a planned redesign. Out of scope for you unless the user opens
that conversation. Don't anticipate or pre-build.

## How to verify everything still works

```bash
# from your laptop, in the repo root:
ssh boliganalyse 'cd /opt/supabase-stack && docker compose ps'
# all containers should be (healthy) or "Up"

curl -sI https://supabase.dev.boliganalyse.ai/rest/v1/
# expect HTTP/2 401 with "No API key" (PostgREST, not Caddy basic auth)

# Then start the frontend:
npm run dev
# open http://localhost:8080, paste a real listing URL from
# nybolig/home/edc/danbolig/estate, watch the row flow through
# private.apartment_listings → public.client_apartment_listings via
# Realtime, status transitioning to "completed" within 60-120s.
```

If the analysis fails at the AI step, tail logs:

```bash
ssh boliganalyse "cd /opt/supabase-stack && docker compose logs -f functions"
```

## Reference

- Repo: `https://github.com/mikkel-kaj/boliganalyse-v2`
- Architecture: `ARCHITECTURE.md`
- Setup-from-scratch guide: `deploy/README.md`
- Project guide for AI agents: `CLAUDE.md`
- Previous agent's persistent memory:
  `/home/mikke/.claude/projects/-home-mikke-dev-boliganalyse-ai/memory/`
  (read `MEMORY.md` to find what's there).

User profile: works in Danish for product/UX discussion, English fine
for code. Direct, action-oriented, expects the agent to execute rather
than ask repeatedly. Will explicitly authorize destructive actions when
needed.

You may now begin. Ask the user where they want to start phase 2.
