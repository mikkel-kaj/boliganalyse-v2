"""Verify the documents migration (`listing_documents` + `inbound_emails`)
applies cleanly on top of the baseline and produces the expected schema
plus permissions.

Spins up an ephemeral Postgres via testcontainers, applies the baseline
migration first, then the documents migration, and asserts each piece of
the spec.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from testcontainers.postgres import PostgresContainer

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
BASELINE_FILE = MIGRATIONS_DIR / "20260428160000_app_schema_baseline.sql"
NEW_MIGRATION_FILE = (
    MIGRATIONS_DIR / "20260429120000_listing_documents_and_inbound_emails.sql"
)


def _bootstrap_supabase_roles(conn: psycopg.Connection) -> None:
    """Create the roles the baseline migration expects to find on a real
    Supabase instance. Vanilla Postgres doesn't ship with them, and the
    testcontainers image uses 'test' as the superuser rather than 'postgres'."""
    with conn.cursor() as cur:
        for role in ("anon", "authenticated", "service_role", "postgres"):
            cur.execute(
                "DO $$ BEGIN "
                f"IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') "
                f"THEN CREATE ROLE {role} NOLOGIN; END IF; END $$;"
            )
    conn.commit()


def _apply_sql_file(conn: psycopg.Connection, path: Path) -> None:
    sql = path.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


@pytest.fixture(scope="module")
def pg_conn() -> Iterator[psycopg.Connection]:
    with PostgresContainer("postgres:15-alpine") as pg:
        dsn = (
            f"host={pg.get_container_host_ip()} "
            f"port={pg.get_exposed_port(5432)} "
            f"dbname={pg.dbname} "
            f"user={pg.username} "
            f"password={pg.password}"
        )
        with psycopg.connect(dsn, autocommit=True) as conn:
            _bootstrap_supabase_roles(conn)
            _apply_sql_file(conn, BASELINE_FILE)
            _apply_sql_file(conn, NEW_MIGRATION_FILE)
            yield conn


def _columns(conn: psycopg.Connection, schema: str, table: str) -> dict[str, dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            """,
            (schema, table),
        )
        return {
            row[0]: {
                "data_type": row[1],
                "is_nullable": row[2],
                "column_default": row[3],
            }
            for row in cur.fetchall()
        }


# ---------------------------------------------------------------------------
# listing_documents
# ---------------------------------------------------------------------------


def test_listing_documents_columns(pg_conn: psycopg.Connection) -> None:
    cols = _columns(pg_conn, "app", "listing_documents")
    expected = {
        "id": ("uuid", "NO"),
        "listing_id": ("uuid", "NO"),
        "kind": ("text", "YES"),
        "source": ("text", "NO"),
        "filename": ("text", "NO"),
        "content_type": ("text", "NO"),
        "size_bytes": ("bigint", "NO"),
        "sha256": ("text", "NO"),
        "storage_bucket": ("text", "NO"),
        "storage_path": ("text", "NO"),
        "source_url": ("text", "YES"),
        "source_email_id": ("uuid", "YES"),
        "created_at": ("timestamp with time zone", "NO"),
    }
    assert set(cols) == set(expected), f"unexpected column set: {set(cols) ^ set(expected)}"
    for name, (data_type, nullable) in expected.items():
        assert cols[name]["data_type"] == data_type, (name, cols[name])
        assert cols[name]["is_nullable"] == nullable, (name, cols[name])

    # storage_bucket default is 'documents'
    assert cols["storage_bucket"]["column_default"] is not None
    assert "documents" in cols["storage_bucket"]["column_default"]


def test_listing_documents_listing_id_fk_cascades(pg_conn: psycopg.Connection) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT confrelid::regclass::text, confdeltype
            FROM pg_constraint
            WHERE conrelid = 'app.listing_documents'::regclass
              AND contype = 'f'
              AND conkey = (
                  SELECT array_agg(attnum)
                  FROM pg_attribute
                  WHERE attrelid = 'app.listing_documents'::regclass
                    AND attname = 'listing_id'
              )
            """
        )
        rows = cur.fetchall()
    assert len(rows) == 1, rows
    target, deltype = rows[0]
    assert target == "app.apartment_listings"
    assert deltype == "c", f"expected ON DELETE CASCADE (c), got {deltype!r}"


def test_listing_documents_source_email_fk(pg_conn: psycopg.Connection) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT confrelid::regclass::text
            FROM pg_constraint
            WHERE conrelid = 'app.listing_documents'::regclass
              AND contype = 'f'
              AND conkey = (
                  SELECT array_agg(attnum)
                  FROM pg_attribute
                  WHERE attrelid = 'app.listing_documents'::regclass
                    AND attname = 'source_email_id'
              )
            """
        )
        rows = cur.fetchall()
    assert len(rows) == 1, rows
    assert rows[0][0] == "app.inbound_emails"


def test_listing_documents_unique_listing_sha(pg_conn: psycopg.Connection) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'app.listing_documents'::regclass
              AND c.contype = 'u'
            GROUP BY c.conname
            HAVING array_agg(a.attname::text ORDER BY a.attname::text)
                   = ARRAY['listing_id', 'sha256']
            """
        )
        assert cur.fetchone() is not None, "missing UNIQUE(listing_id, sha256)"


def test_listing_documents_listing_id_index(pg_conn: psycopg.Connection) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'app'
              AND tablename = 'listing_documents'
              AND indexdef ILIKE '%(listing_id)%'
              AND indexname <> (
                  SELECT conname FROM pg_constraint
                  WHERE conrelid = 'app.listing_documents'::regclass
                    AND contype = 'u'
                  LIMIT 1
              )
            """
        )
        assert cur.fetchone() is not None, "missing index on listing_documents.listing_id"


# ---------------------------------------------------------------------------
# inbound_emails
# ---------------------------------------------------------------------------


def test_inbound_emails_columns(pg_conn: psycopg.Connection) -> None:
    cols = _columns(pg_conn, "app", "inbound_emails")
    expected = {
        "id": ("uuid", "NO"),
        "inbox_local_part": ("text", "NO"),
        "listing_id": ("uuid", "YES"),
        "from_address": ("text", "YES"),
        "subject": ("text", "YES"),
        "raw_storage_path": ("text", "YES"),
        "status": ("text", "NO"),
        "error_message": ("text", "YES"),
        "received_at": ("timestamp with time zone", "NO"),
    }
    assert set(cols) == set(expected), f"unexpected column set: {set(cols) ^ set(expected)}"
    for name, (data_type, nullable) in expected.items():
        assert cols[name]["data_type"] == data_type, (name, cols[name])
        assert cols[name]["is_nullable"] == nullable, (name, cols[name])


def test_inbound_emails_listing_fk_set_null(pg_conn: psycopg.Connection) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT confrelid::regclass::text, confdeltype
            FROM pg_constraint
            WHERE conrelid = 'app.inbound_emails'::regclass
              AND contype = 'f'
              AND conkey = (
                  SELECT array_agg(attnum)
                  FROM pg_attribute
                  WHERE attrelid = 'app.inbound_emails'::regclass
                    AND attname = 'listing_id'
              )
            """
        )
        rows = cur.fetchall()
    assert len(rows) == 1, rows
    target, deltype = rows[0]
    assert target == "app.apartment_listings"
    assert deltype == "n", f"expected ON DELETE SET NULL (n), got {deltype!r}"


def test_inbound_emails_indexes(pg_conn: psycopg.Connection) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'app' AND tablename = 'inbound_emails'
            """
        )
        defs = [row[0] for row in cur.fetchall()]
    assert any("(inbox_local_part)" in d for d in defs), defs
    assert any("(listing_id)" in d for d in defs), defs


# ---------------------------------------------------------------------------
# apartment_listings.email_lead_sent_at
# ---------------------------------------------------------------------------


def test_apartment_listings_email_lead_sent_at(pg_conn: psycopg.Connection) -> None:
    cols = _columns(pg_conn, "app", "apartment_listings")
    assert "email_lead_sent_at" in cols
    assert cols["email_lead_sent_at"]["data_type"] == "timestamp with time zone"
    assert cols["email_lead_sent_at"]["is_nullable"] == "YES"
    assert cols["email_lead_sent_at"]["column_default"] is None


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------


def _has_any_privilege(conn: psycopg.Connection, role: str, schema: str, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.role_table_grants
            WHERE grantee = %s AND table_schema = %s AND table_name = %s
            LIMIT 1
            """,
            (role, schema, table),
        )
        return cur.fetchone() is not None


@pytest.mark.parametrize("table", ["listing_documents", "inbound_emails"])
def test_anon_has_no_privileges(pg_conn: psycopg.Connection, table: str) -> None:
    assert not _has_any_privilege(pg_conn, "anon", "app", table), (
        f"anon should not have any grants on app.{table}"
    )


@pytest.mark.parametrize("table", ["listing_documents", "inbound_emails"])
def test_authenticated_has_no_privileges(pg_conn: psycopg.Connection, table: str) -> None:
    assert not _has_any_privilege(pg_conn, "authenticated", "app", table), (
        f"authenticated should not have any grants on app.{table}"
    )


@pytest.mark.parametrize("table", ["listing_documents", "inbound_emails"])
def test_service_role_has_full_privileges(pg_conn: psycopg.Connection, table: str) -> None:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT privilege_type
            FROM information_schema.role_table_grants
            WHERE grantee = 'service_role'
              AND table_schema = 'app'
              AND table_name = %s
            """,
            (table,),
        )
        privs = {row[0] for row in cur.fetchall()}
    for needed in ("SELECT", "INSERT", "UPDATE", "DELETE"):
        assert needed in privs, f"service_role missing {needed} on app.{table} (have {privs})"
