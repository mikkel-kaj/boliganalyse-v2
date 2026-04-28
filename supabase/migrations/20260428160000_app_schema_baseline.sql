-- Baseline schema for the FastAPI rewrite.
-- Tears down the legacy private/public split (with its triggers and Realtime
-- publication) and rebuilds a single tenant in the `app` schema. Only
-- service_role can touch it; the API server is the sole client.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tear down legacy objects (idempotent)
-- ---------------------------------------------------------------------------

-- Realtime publication entries from the old setup
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'client_apartment_listings'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.client_apartment_listings;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'apartment_listings'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.apartment_listings;
    END IF;
END $$;

-- Mirror table + its trigger functions
DROP TABLE IF EXISTS public.client_apartment_listings CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_listing() CASCADE;
DROP FUNCTION IF EXISTS public.handle_update_listing() CASCADE;

-- The old anon-insert feedback table (API now writes to app.feedback as service_role)
DROP TABLE IF EXISTS public.feedback CASCADE;

-- Old apartment_listings table (only present on a fresh DB before the
-- private-schema migration ran — defensive)
DROP TABLE IF EXISTS public.apartment_listings CASCADE;

-- Private schema (table, indexes, triggers, derive functions, the lot)
DROP SCHEMA IF EXISTS private CASCADE;


-- ---------------------------------------------------------------------------
-- 2. Build the new app schema
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.apartment_listings (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- URL identity
    url                text NOT NULL UNIQUE,
    normalized_url     text NOT NULL UNIQUE,
    url_redirect       text,
    realtor            text,

    -- Raw scrape inputs (internal — never returned by the API)
    html_primary       text,
    html_redirect      text,
    text_primary       text,
    text_redirect      text,

    -- State machine — values map to api/src/types/status.py AnalysisStatus enum
    status             text NOT NULL DEFAULT 'pending',
    error_message      text,

    -- Result
    analysis           jsonb,
    property_image_url text,

    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX apartment_listings_normalized_url_idx
    ON app.apartment_listings (normalized_url);
CREATE INDEX apartment_listings_created_at_idx
    ON app.apartment_listings (created_at DESC);
CREATE INDEX apartment_listings_analysis_gin_idx
    ON app.apartment_listings USING gin (analysis);


CREATE TABLE app.feedback (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_type     text NOT NULL,
    message           text NOT NULL,
    email             text,
    listing_id        uuid REFERENCES app.apartment_listings(id) ON DELETE SET NULL,
    property_address  text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_created_at_idx ON app.feedback (created_at DESC);


-- Auto-touch updated_at on row updates
CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER apartment_listings_touch_updated_at
    BEFORE UPDATE ON app.apartment_listings
    FOR EACH ROW
    EXECUTE FUNCTION app.touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3. Permissions — service_role only
-- ---------------------------------------------------------------------------

REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;

-- anon and authenticated must have zero access — the API is the only client
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON SCHEMA app FROM anon';
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON SCHEMA app FROM authenticated';
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA app FROM authenticated';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM authenticated';
    END IF;
END $$;

GRANT USAGE ON SCHEMA app TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT ALL ON SEQUENCES TO service_role;

-- postgres superuser also gets default privileges (for migrations run as postgres)
ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT ALL ON TABLES TO postgres;

COMMIT;
