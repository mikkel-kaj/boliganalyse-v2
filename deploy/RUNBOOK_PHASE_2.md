# Phase 2 Deploy Runbook

Take whatever's currently merged on `main` and roll it onto the live
`dev.boliganalyse.ai` stack.

This runbook is **incremental** — it assumes the Phase 1 stack is already
running on the Hetzner box (Supabase + Caddy + api + frontend, all the
DNS for `supabase`/`api`/`dev` already pointed and TLS-issued). If the
box is fresh, do the from-scratch sections in [`README.md`](README.md)
first, then come back here.

What Phase 2 adds on top of the running stack:

- A new private Storage bucket (`documents`) for sales-material PDFs.
- `INBOUND_EMAIL_SECRET` in the server's `.env` — shared HMAC between
  Postfix and the api webhook.
- A Postfix container receiving mail at `*@inbox.boliganalyse.ai`,
  needing its own DNS records, PTR record, and Let's Encrypt cert.
- The `api` container picks up `awaiting_documents` plus the
  `/webhooks/inbound-email`, `/listings/{id}/documents` routes from the
  same code rsync.
- A new baseline migration column-set (apply once, idempotent).

Read top-to-bottom on the first run. Each step has a **command** block
and a **verify** block — paste the command, then check the verify line
matches before moving on.

---

## 0. Prerequisites

Run these on your laptop, not the VPS.

```bash
# Latest main checked out:
git switch main
git pull --ff-only

# The clean working tree check — deploy scripts rsync from the working
# directory, so any uncommitted change ships too.
git status --porcelain
```

**Verify:** `git status --porcelain` is empty.

```bash
# SSH alias works:
ssh boliganalyse 'echo ok && uname -a'
```

**Verify:** prints `ok` and an Ubuntu kernel string.

```bash
# Tools you'll need locally:
command -v rsync supabase docker uv jq curl
```

**Verify:** every command resolves to a path. If `supabase` is missing,
`brew install supabase/tap/supabase`. If `uv` is missing, install per
<https://docs.astral.sh/uv/>.

---

## 1. DNS records for inbound mail

If Phase 2 has been deployed once before, skip to step 2.

Add at the registrar (these are **in addition to** the Phase 1 records
for `supabase` / `api` / `dev`):

| Record | Type | Value |
| --- | --- | --- |
| `inbox.boliganalyse.ai.` | A | `178.104.213.102` |
| `inbox.boliganalyse.ai.` | MX (priority 10) | `inbox.boliganalyse.ai.` |

Then set the **PTR (rDNS)** record manually in the Hetzner Cloud Console
(Servers → your server → Networking tab → IP → set rDNS):

```
178.104.213.102  ->  inbox.boliganalyse.ai
```

This step CANNOT be scripted — Hetzner gates rDNS behind their console.

**Verify** (allow up to a few minutes for propagation):

```bash
dig +short A   inbox.boliganalyse.ai
dig +short MX  inbox.boliganalyse.ai
dig +short -x  178.104.213.102
```

Expected:
- `dig A` → `178.104.213.102`
- `dig MX` → `10 inbox.boliganalyse.ai.`
- `dig -x` → `inbox.boliganalyse.ai.`

---

## 2. Apply database migrations

Open an SSH tunnel to Postgres, then push migrations.

```bash
# In one terminal:
ssh -fN -L 5432:localhost:5432 boliganalyse

# In another:
export SELF_HOSTED_DB_URL="postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres"
./deploy/scripts/apply-migrations.sh
```

`<POSTGRES_PASSWORD>` is the value in `/opt/supabase-stack/.env` on the
server (`grep ^POSTGRES_PASSWORD= /opt/supabase-stack/.env` over SSH).

**Verify:** the script prints `Done.` Re-running is idempotent —
applied migrations are tracked in `supabase_migrations.schema_migrations`.

When done, kill the tunnel:

```bash
pkill -f 'ssh -fN -L 5432:localhost:5432 boliganalyse' || true
```

---

## 3. Generate and set `INBOUND_EMAIL_SECRET`

The api webhook authenticates Postfix via this secret; both sides must
agree, or every inbound email returns 401 and gets dropped.

If `INBOUND_EMAIL_SECRET` is already set in `/opt/supabase-stack/.env`,
skip this step (rotation is a separate operation — see "Rotate inbound
email secret" below).

```bash
# Generate a value on your laptop:
openssl rand -hex 32

# Edit the env file on the server (the file is mode 600, so use sudo).
ssh boliganalyse
sudo nano /opt/supabase-stack/.env
# Add or replace this line, paste the value from above:
#   INBOUND_EMAIL_SECRET=<the 64-char hex string>
```

**Verify** — over the same SSH session:

```bash
sudo grep '^INBOUND_EMAIL_SECRET=' /opt/supabase-stack/.env
```

Expect a single line of the form `INBOUND_EMAIL_SECRET=<64 hex chars>`.

Exit the SSH session.

The api container picks the value up on its next recreate (step 6
below); the Postfix container picks it up on step 7's `up -d --build`.

---

## 4. Provision the postfix TLS cert

Run on the VPS — it touches `/etc/letsencrypt` and `/etc/cron.d`:

```bash
ssh boliganalyse
sudo /opt/supabase-stack/deploy/scripts/setup-postfix.sh
```

The script:
1. Confirms DNS is in place (interactive — type `yes`).
2. Acquires a Let's Encrypt cert via certbot --standalone, which needs
   port 80. The script prints the exact `docker compose stop caddy` /
   `start caddy` commands; run them in another shell while certbot is
   acquiring, then continue. Caddy is offline for ~30 s.
3. Symlinks the cert into `/opt/supabase-stack/postfix-tls/` so the
   postfix container's bind-mount can read it.
4. Installs a daily renewal cron at `/etc/cron.d/boliganalyse-postfix-renew`.

**Verify:**

```bash
sudo ls -l /opt/supabase-stack/postfix-tls/
# fullchain.pem -> /etc/letsencrypt/live/inbox.boliganalyse.ai/fullchain.pem
# privkey.pem   -> /etc/letsencrypt/live/inbox.boliganalyse.ai/privkey.pem

sudo cat /etc/cron.d/boliganalyse-postfix-renew
# 0 3 * * * root certbot renew --quiet --deploy-hook ...
```

Exit the SSH session.

---

## 5. (Re)deploy the API

Back on your laptop:

```bash
./deploy/scripts/deploy-api.sh boliganalyse
```

This rsyncs `api/` to `/opt/supabase-stack/api/` and rebuilds the api
container. The `up -d --build api` step also re-reads the compose env,
so the `INBOUND_EMAIL_SECRET` you set in step 3 takes effect now.

**Verify** (in a separate terminal — the deploy script tails logs until
Ctrl-C):

```bash
curl -fsS https://api.dev.boliganalyse.ai/health
# {"status":"ok"}
```

Stop the log tail (Ctrl-C). The api container is up.

---

## 6. Deploy postfix

```bash
./deploy/scripts/deploy-postfix.sh boliganalyse
```

This rsyncs `deploy/postfix/` to `/opt/supabase-stack/postfix/` and
runs `docker compose ... up -d --build postfix`. The 5-second
"press Ctrl-C to abort" pause covers the ~2-3 s of port-25 downtime
during container recreate.

**Verify** (separate terminal — the script tails logs):

```bash
# From your laptop, hit port 25:
nc -zv inbox.boliganalyse.ai 25
# Connection to inbox.boliganalyse.ai 25 port [tcp/smtp] succeeded!
```

Stop the log tail (Ctrl-C). Optional deeper smoke test from any
external host with `swaks` installed:

```bash
swaks --to test@inbox.boliganalyse.ai \
      --server inbox.boliganalyse.ai \
      --from sender@home.dk \
      --header 'Subject: postfix smoke' \
      --body 'hello'
```

Use a sender domain that is on the
[`deploy/postfix/sender_access`](postfix/sender_access) whitelist
(`home.dk`, `mindworking.dk`, etc) — anything else is rejected at
`RCPT TO`. The line should show up in the postfix log within a second.

---

## 7. Bootstrap the Storage bucket

The `documents` bucket is the destination for both scraped PDFs and
broker email attachments. `DocumentStorage.ensure_bucket()` runs
lazily on the first upload, but the very first scrape after a fresh
deploy can race the bucket-create — bootstrap it eagerly:

```bash
./deploy/scripts/ensure-documents-bucket.sh boliganalyse
```

This execs inside the api container so it can reuse the supabase-py
client + service-role key already in the compose env.

**Verify:** the script prints `OK: bucket 'documents' present at <url>`.
Re-running is idempotent.

If you'd rather hit a remote Supabase from your laptop (e.g. for an
ad-hoc check), use:

```bash
./deploy/scripts/ensure-documents-bucket.sh --local
```

This reads `api/.env` locally and uses `uv run`. You'll need the
public Supabase URL + service-role key in that file.

> **Note:** the very first run of this script in a brand-new
> environment is the live-fire test — there's no way to fully exercise
> it locally without a real Supabase Storage. If it fails on the first
> run, the api container's logs (`docker compose ... logs api`) plus
> `docker exec` to poke at the container interactively are the
> debugging path.

---

## 8. (Optional) Frontend deploy

If frontend changes shipped in this batch:

```bash
./deploy/scripts/deploy-frontend.sh boliganalyse
```

**Verify:** open `https://dev.boliganalyse.ai/` and check the page
loads + the network tab shows `https://api.dev.boliganalyse.ai` as
the request target.

---

## 9. End-to-end smoke test

```bash
./deploy/scripts/smoke-test-phase-2.sh https://home.dk/<some-real-listing>
```

Use a real Home.dk listing URL — those drop to `awaiting_documents`
and require the broker email round-trip, exercising the full
api → Claude → home.dk contact form → Postfix → webhook → Storage
loop.

The script polls every 5s for up to 3 minutes by default, logging
status transitions and exiting:

| Exit | Meaning |
| --- | --- |
| `0` | At least one document appeared. PASS. |
| `2` | Listing reached a terminal error status (`error`, `invalid_url`, …). |
| `3` | Timed out before any document arrived. |

Tune the wall-clock budget with `--timeout SECS`. If the broker is slow,
180s isn't always enough — bump to 600 and re-run.

If documents don't arrive, head to step 10.

---

## 10. Where to look when things go wrong

```bash
# API logs (status-transition lines, exception traces):
ssh boliganalyse 'cd /opt/supabase-stack && docker compose \
  -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \
  logs --tail=200 api'

# Postfix logs (SMTP rejections, pipe to webhook):
ssh boliganalyse 'cd /opt/supabase-stack && docker compose \
  -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \
  logs --tail=200 postfix'

# Caddy (frontend / api routing, TLS issues):
ssh boliganalyse 'docker logs --tail=200 supabase-caddy'

# Supabase service logs (Storage, auth, postgrest):
ssh boliganalyse 'cd /opt/supabase-stack && docker compose logs --tail=200 storage rest'
```

Common Phase 2-specific failure modes:

- **Inbound mail returns 401 from the api webhook** — `INBOUND_EMAIL_SECRET`
  doesn't match between Postfix and api. Re-check step 3, then recreate
  *both* containers (`up -d --no-deps api postfix`).
- **`Bucket not found: documents`** in the api logs while a scrape runs —
  step 7 wasn't run, or it ran against the wrong Supabase URL. Re-run.
- **Postfix container CrashLoopBackOff** — TLS files unreadable.
  `ls -l /opt/supabase-stack/postfix-tls/` should show two symlinks
  pointing into `/etc/letsencrypt/live/inbox.boliganalyse.ai/`. Re-run
  `setup-postfix.sh`.
- **`PGRST: schema "app" not found`** — the rest container's
  `PGRST_DB_SCHEMAS` doesn't include `app`. Add `app` to the comma-
  separated list in `/opt/supabase-stack/.env` and recreate the rest
  container.
- **Mail bounces with `554 5.7.1 Sender address rejected`** — the
  sender domain isn't whitelisted in
  [`deploy/postfix/sender_access`](postfix/sender_access). Add it,
  re-run `deploy-postfix.sh`.

The internal `error_message` column on `app.apartment_listings` (visible
in Supabase Studio under <https://supabase.dev.boliganalyse.ai>) holds
the full Python traceback for any analysis that errored — the API
intentionally never returns it to the public projection.

---

## 11. Rollback

The api container is the only thing that meaningfully versions per
deploy — postfix is config-only (no schema changes), and the migration
applied in step 2 is forward-only.

### 11a. Roll back the api container

```bash
# On your laptop:
git switch <previous-good-commit>
./deploy/scripts/deploy-api.sh boliganalyse
git switch main
```

The api container drops to the old image in ~5-10s.

### 11b. Roll back the migration (only if absolutely necessary)

`apply-migrations.sh` does not generate down migrations. If a deploy
needs the Phase 2 baseline reverted, do it manually — and only after
a `pg_dump`:

```bash
ssh boliganalyse 'docker exec supabase-db pg_dump -U postgres -d postgres -Fc \
  -f /tmp/pre-rollback-$(date +%s).dump'
ssh boliganalyse 'docker exec -it supabase-db psql -U postgres -d postgres'
```

Then in psql, drop the affected tables / columns / enum values. The
specific objects depend on which migration you're reverting — consult
the migration file under `supabase/migrations/` and reverse its DDL.
Don't forget the row in `supabase_migrations.schema_migrations`:

```sql
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '<the timestamp of the migration file>';
```

### 11c. Disable inbound mail without rolling back

Stop the postfix container; brokers that try to deliver will see a
TCP RST and either retry or bounce locally. The api keeps running:

```bash
ssh boliganalyse 'cd /opt/supabase-stack && docker compose \
  -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \
  stop postfix'
```

Restart with `start postfix` to bring it back.

---

## Appendix — quick command index

| Action | Command |
| --- | --- |
| Apply migrations | `./deploy/scripts/apply-migrations.sh` |
| Deploy api | `./deploy/scripts/deploy-api.sh boliganalyse` |
| Deploy postfix | `./deploy/scripts/deploy-postfix.sh boliganalyse` |
| Deploy frontend | `./deploy/scripts/deploy-frontend.sh boliganalyse` |
| Bootstrap bucket | `./deploy/scripts/ensure-documents-bucket.sh boliganalyse` |
| Smoke test | `./deploy/scripts/smoke-test-phase-2.sh <url>` |
| TLS / cron bootstrap | `sudo /opt/supabase-stack/deploy/scripts/setup-postfix.sh` (on VPS) |

Every deploy script supports `--dry-run` (or `--help`) for printing the
plan without touching anything.

### Rotate inbound email secret

```bash
NEW=$(openssl rand -hex 32)
ssh boliganalyse "sudo sed -i 's|^INBOUND_EMAIL_SECRET=.*|INBOUND_EMAIL_SECRET=${NEW}|' /opt/supabase-stack/.env"
# Recreate both containers so they re-read .env in lockstep:
ssh boliganalyse 'cd /opt/supabase-stack && docker compose \
  -f docker-compose.yml -f docker-compose.caddy.yml -f docker-compose.app.yml \
  up -d --no-deps api postfix'
```

There's a small window (a few seconds) where one side has the new
secret and the other has the old — any in-flight email during that
window will 401 and bounce. Brokers retry, so the practical impact is
minimal, but rotate during a quiet period.
