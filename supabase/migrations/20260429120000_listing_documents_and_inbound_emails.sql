-- Documents feature, phase 1: schema only.
-- Adds two new tables (listing_documents, inbound_emails) and an
-- email_lead_sent_at column on apartment_listings. The API is the only
-- writer; permissions follow the baseline pattern (service_role + postgres
-- only, anon and authenticated revoked).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. inbound_emails — one row per email Postfix delivers to us
-- ---------------------------------------------------------------------------
-- Created before listing_documents because listing_documents.source_email_id
-- references it.

CREATE TABLE app.inbound_emails (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The local part (before @) of the To address — the per-listing inbox we
    -- assigned when POSTing the broker lead form.
    inbox_local_part  text NOT NULL,

    -- Resolved listing once we match the inbox_local_part. NULL until matched.
    listing_id        uuid REFERENCES app.apartment_listings(id) ON DELETE SET NULL,

    from_address      text,
    subject           text,

    -- Path to the full RFC822 .eml in Storage (for replay/debug).
    raw_storage_path  text,

    -- State machine: 'received' | 'matched' | 'unmatched' | 'parsed' | 'error'
    status            text NOT NULL,
    error_message     text,

    received_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbound_emails_inbox_local_part_idx
    ON app.inbound_emails (inbox_local_part);
CREATE INDEX IF NOT EXISTS inbound_emails_listing_id_idx
    ON app.inbound_emails (listing_id);


-- ---------------------------------------------------------------------------
-- 2. listing_documents — one row per stored PDF
-- ---------------------------------------------------------------------------

CREATE TABLE app.listing_documents (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    listing_id       uuid NOT NULL REFERENCES app.apartment_listings(id) ON DELETE CASCADE,

    -- Free-text label from the parser/regex (e.g. 'salgsopstilling',
    -- 'tilstandsrapport'). May be empty; no CHECK constraint by design.
    kind             text,

    -- 'scrape' | 'email' | 'manual'
    source           text NOT NULL,

    filename         text NOT NULL,
    content_type     text NOT NULL,
    size_bytes       bigint NOT NULL,
    sha256           text NOT NULL,

    storage_bucket   text NOT NULL DEFAULT 'documents',
    storage_path     text NOT NULL,  -- e.g. 'documents/{listing_id}/{sha256}.pdf'

    -- For scrape source: original URL. For email source: original Mindworking
    -- URL extracted from the email body.
    source_url       text,

    -- NULL for scrape source.
    source_email_id  uuid REFERENCES app.inbound_emails(id),

    created_at       timestamptz NOT NULL DEFAULT now(),

    -- Same content not stored twice for the same listing.
    UNIQUE (listing_id, sha256)
);

CREATE INDEX IF NOT EXISTS listing_documents_listing_id_idx
    ON app.listing_documents (listing_id);


-- ---------------------------------------------------------------------------
-- 3. apartment_listings.email_lead_sent_at
-- ---------------------------------------------------------------------------
-- NULL = no broker lead form submitted (default for Danbolig).
-- Non-NULL = we POSTed the broker form and are waiting on email-delivered docs.

ALTER TABLE app.apartment_listings
    ADD COLUMN email_lead_sent_at timestamptz;


-- ---------------------------------------------------------------------------
-- 4. Permissions — same pattern as baseline (service_role only)
-- ---------------------------------------------------------------------------

REVOKE ALL ON app.inbound_emails FROM PUBLIC;
REVOKE ALL ON app.listing_documents FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON app.inbound_emails FROM anon';
        EXECUTE 'REVOKE ALL ON app.listing_documents FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON app.inbound_emails FROM authenticated';
        EXECUTE 'REVOKE ALL ON app.listing_documents FROM authenticated';
    END IF;
END $$;

GRANT ALL ON app.inbound_emails TO service_role;
GRANT ALL ON app.listing_documents TO service_role;

-- Default privileges in schema app already cover future tables for
-- service_role and postgres (set in the baseline migration), so newly
-- created tables inherit them — no further ALTER DEFAULT PRIVILEGES needed.

COMMIT;
