"""Unit tests for `DocumentRepository`. The supabase client is replaced
by a fake that mimics PostgREST's chained query builder."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from src.repositories.document import DocumentRepository
from src.types.models import NewListingDocument


@dataclass
class _Response:
    data: Any


class _FakeQuery:
    """Records the chain of calls and resolves to a fixed response."""

    def __init__(self, table: _FakeTable, op: str) -> None:
        self._table = table
        self._op = op
        self._payload: Any = None
        self._filters: list[tuple[str, Any]] = []
        self._maybe_single = False
        self._order: tuple[str, bool] | None = None

    def select(self, _columns: str) -> _FakeQuery:
        return self

    def insert(self, payload: dict[str, Any]) -> _FakeQuery:
        self._payload = payload
        return self

    def eq(self, column: str, value: Any) -> _FakeQuery:
        self._filters.append((column, value))
        return self

    def maybe_single(self) -> _FakeQuery:
        self._maybe_single = True
        return self

    def order(self, column: str, *, desc: bool = False) -> _FakeQuery:
        self._order = (column, desc)
        return self

    async def execute(self) -> _Response:
        if self._op == "insert":
            assert self._payload is not None
            row = {**self._payload}
            row.setdefault("id", f"doc-{len(self._table.rows) + 1}")
            row.setdefault("created_at", "2026-04-29T12:00:00+00:00")
            row.setdefault("storage_bucket", "documents")
            self._table.rows.append(row)
            return _Response(data=[row])

        rows = self._table.rows
        for col, val in self._filters:
            rows = [r for r in rows if r.get(col) == val]
        if self._order:
            rows = sorted(rows, key=lambda r: r.get(self._order[0]), reverse=self._order[1])

        if self._maybe_single:
            if not rows:
                return _Response(data=None)
            return _Response(data=rows[0])
        return _Response(data=list(rows))


class _FakeTable:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def select(self, columns: str) -> _FakeQuery:
        q = _FakeQuery(self, "select")
        return q.select(columns)

    def insert(self, payload: dict[str, Any]) -> _FakeQuery:
        return _FakeQuery(self, "insert").insert(payload)


class _FakeSchema:
    def __init__(self, table: _FakeTable) -> None:
        self._table = table

    def table(self, _name: str) -> _FakeTable:
        return self._table


class _FakeClient:
    def __init__(self) -> None:
        self.table = _FakeTable()

    def schema(self, _name: str) -> _FakeSchema:
        return _FakeSchema(self.table)


@pytest.fixture
def fake_client() -> _FakeClient:
    return _FakeClient()


@pytest.fixture
def repo(fake_client: _FakeClient) -> DocumentRepository:
    return DocumentRepository(fake_client)  # type: ignore[arg-type]


def _new_doc(**overrides: Any) -> NewListingDocument:
    base = {
        "listing_id": "11111111-1111-1111-1111-111111111111",
        "source": "scrape",
        "filename": "salgsopstilling.pdf",
        "content_type": "application/pdf",
        "size_bytes": 12345,
        "sha256": "a" * 64,
        "storage_path": "documents/listing-1/abc.pdf",
        "kind": "salgsopstilling",
        "source_url": "https://danbolig.mindworking.eu/api/Public/Documents/abc",
    }
    base.update(overrides)
    return NewListingDocument(**base)


async def test_insert_returns_full_row(repo: DocumentRepository) -> None:
    doc = _new_doc()
    inserted = await repo.insert(doc)

    assert inserted.id is not None
    assert inserted.listing_id == doc.listing_id
    assert inserted.filename == doc.filename
    assert inserted.sha256 == doc.sha256
    assert inserted.storage_bucket == "documents"
    assert inserted.kind == "salgsopstilling"
    assert inserted.source_email_id is None  # not provided


async def test_list_for_listing_filters_by_listing_id(
    repo: DocumentRepository,
) -> None:
    listing_a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    listing_b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    await repo.insert(_new_doc(listing_id=listing_a, sha256="a" * 64))
    await repo.insert(_new_doc(listing_id=listing_a, sha256="b" * 64))
    await repo.insert(_new_doc(listing_id=listing_b, sha256="c" * 64))

    rows = await repo.list_for_listing(listing_a)
    assert len(rows) == 2
    assert all(r.listing_id == listing_a for r in rows)


async def test_get_returns_row(repo: DocumentRepository) -> None:
    inserted = await repo.insert(_new_doc())
    got = await repo.get(inserted.id)
    assert got is not None
    assert got.id == inserted.id


async def test_get_returns_none_for_missing(repo: DocumentRepository) -> None:
    got = await repo.get("nonexistent-id")
    assert got is None


async def test_find_by_listing_and_sha_match(repo: DocumentRepository) -> None:
    inserted = await repo.insert(_new_doc(sha256="d" * 64))
    found = await repo.find_by_listing_and_sha(inserted.listing_id, "d" * 64)
    assert found is not None
    assert found.id == inserted.id


async def test_find_by_listing_and_sha_no_match(
    repo: DocumentRepository,
) -> None:
    await repo.insert(_new_doc(sha256="e" * 64))
    found = await repo.find_by_listing_and_sha(
        "11111111-1111-1111-1111-111111111111", "f" * 64
    )
    assert found is None


async def test_find_by_listing_and_sha_returns_none_for_unknown_listing(
    repo: DocumentRepository,
) -> None:
    found = await repo.find_by_listing_and_sha("does-not-exist", "a" * 64)
    assert found is None
