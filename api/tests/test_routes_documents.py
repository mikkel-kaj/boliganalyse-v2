"""Integration tests for the document list / download routes.

The supabase client and Storage are stubbed via FastAPI dependency
overrides — these tests never touch the real backend."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.routes import documents as documents_route
from src.routes.dependencies import (
    get_document_repository,
    get_document_storage,
    get_repository,
)
from src.types.models import ListingDocumentRow


def _row(
    *,
    doc_id: str,
    listing_id: str,
    filename: str = "salgsopstilling.pdf",
    content_type: str = "application/pdf",
    storage_path: str | None = None,
    kind: str | None = "salgsopstilling",
    source: str = "danbolig",
    source_url: str | None = "https://example.com/doc.pdf",
    size_bytes: int = 1024,
    created_at: str = "2026-04-29T12:00:00+00:00",
) -> ListingDocumentRow:
    return ListingDocumentRow(
        id=doc_id,
        listing_id=listing_id,
        kind=kind,
        source=source,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        sha256="0" * 64,
        storage_bucket="documents",
        storage_path=storage_path or f"{listing_id}/{doc_id}.pdf",
        source_url=source_url,
        source_email_id=None,
        created_at=created_at,
    )


class _FakeListingRepo:
    def __init__(self, listings: dict[str, dict[str, Any]] | None = None) -> None:
        self._listings = listings or {}

    async def get_by_id(self, listing_id: str) -> dict[str, Any] | None:
        return self._listings.get(listing_id)


class _FakeDocumentRepo:
    def __init__(self, rows: list[ListingDocumentRow] | None = None) -> None:
        self.rows = rows or []

    async def list_for_listing(self, listing_id: str) -> list[ListingDocumentRow]:
        return [r for r in self.rows if r.listing_id == listing_id]

    async def get(self, doc_id: str) -> ListingDocumentRow | None:
        return next((r for r in self.rows if r.id == doc_id), None)


class _FakeStorage:
    def __init__(self, files: dict[str, bytes] | None = None) -> None:
        self.files = files or {}
        self.downloads: list[str] = []

    async def download(self, path: str) -> bytes:
        self.downloads.append(path)
        if path not in self.files:
            raise RuntimeError(f"missing object: {path}")
        return self.files[path]


def _make_app(
    *,
    listing_repo: _FakeListingRepo,
    document_repo: _FakeDocumentRepo,
    storage: _FakeStorage,
) -> FastAPI:
    app = FastAPI()
    app.include_router(documents_route.router)
    app.dependency_overrides[get_repository] = lambda: listing_repo
    app.dependency_overrides[get_document_repository] = lambda: document_repo
    app.dependency_overrides[get_document_storage] = lambda: storage
    return app


@pytest.fixture
def listing_id() -> str:
    return "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def listing_row(listing_id: str) -> dict[str, Any]:
    return {"id": listing_id, "url": "https://danbolig.dk/x"}


# ---------------------------------------------------------------------------
# GET /listings/{id}/documents
# ---------------------------------------------------------------------------


def test_list_documents_returns_two_rows(listing_id: str, listing_row: dict[str, Any]) -> None:
    rows = [
        _row(doc_id="doc-1", listing_id=listing_id, filename="salgsopstilling.pdf"),
        _row(
            doc_id="doc-2",
            listing_id=listing_id,
            filename="tilstandsrapport.pdf",
            kind="tilstandsrapport",
            source_url=None,
        ),
    ]
    app = _make_app(
        listing_repo=_FakeListingRepo({listing_id: listing_row}),
        document_repo=_FakeDocumentRepo(rows),
        storage=_FakeStorage(),
    )

    client = TestClient(app)
    response = client.get(f"/listings/{listing_id}/documents")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0] == {
        "id": "doc-1",
        "kind": "salgsopstilling",
        "filename": "salgsopstilling.pdf",
        "content_type": "application/pdf",
        "size_bytes": 1024,
        "source": "danbolig",
        "source_url": "https://example.com/doc.pdf",
        "created_at": "2026-04-29T12:00:00+00:00",
    }
    assert body[1]["id"] == "doc-2"
    assert body[1]["kind"] == "tilstandsrapport"
    assert body[1]["source_url"] is None
    # internal/server-only fields stay hidden
    assert "storage_path" not in body[0]
    assert "storage_bucket" not in body[0]
    assert "sha256" not in body[0]


def test_list_documents_returns_empty_for_listing_with_none(
    listing_id: str, listing_row: dict[str, Any]
) -> None:
    app = _make_app(
        listing_repo=_FakeListingRepo({listing_id: listing_row}),
        document_repo=_FakeDocumentRepo([]),
        storage=_FakeStorage(),
    )

    client = TestClient(app)
    response = client.get(f"/listings/{listing_id}/documents")

    assert response.status_code == 200
    assert response.json() == []


def test_list_documents_404_for_missing_listing() -> None:
    app = _make_app(
        listing_repo=_FakeListingRepo({}),
        document_repo=_FakeDocumentRepo([]),
        storage=_FakeStorage(),
    )

    client = TestClient(app)
    response = client.get("/listings/does-not-exist/documents")

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /listings/{id}/documents/{doc_id}
# ---------------------------------------------------------------------------


def test_download_streams_bytes_with_correct_headers(
    listing_id: str, listing_row: dict[str, Any]
) -> None:
    pdf_bytes = b"%PDF-1.4\nfake content"
    row = _row(
        doc_id="doc-1",
        listing_id=listing_id,
        filename="salgsopstilling.pdf",
        storage_path=f"{listing_id}/doc-1.pdf",
    )
    storage = _FakeStorage({f"{listing_id}/doc-1.pdf": pdf_bytes})
    app = _make_app(
        listing_repo=_FakeListingRepo({listing_id: listing_row}),
        document_repo=_FakeDocumentRepo([row]),
        storage=storage,
    )

    client = TestClient(app)
    response = client.get(f"/listings/{listing_id}/documents/doc-1")

    assert response.status_code == 200
    assert response.content == pdf_bytes
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "private, max-age=3600"
    disposition = response.headers["content-disposition"]
    assert disposition.startswith("inline; ")
    assert 'filename="salgsopstilling.pdf"' in disposition
    assert storage.downloads == [f"{listing_id}/doc-1.pdf"]


def test_download_404_for_unknown_doc_id(
    listing_id: str, listing_row: dict[str, Any]
) -> None:
    app = _make_app(
        listing_repo=_FakeListingRepo({listing_id: listing_row}),
        document_repo=_FakeDocumentRepo([]),
        storage=_FakeStorage(),
    )

    client = TestClient(app)
    response = client.get(f"/listings/{listing_id}/documents/missing-doc")

    assert response.status_code == 404


def test_download_404_when_doc_belongs_to_different_listing(
    listing_id: str, listing_row: dict[str, Any]
) -> None:
    other_listing = "22222222-2222-2222-2222-222222222222"
    row = _row(doc_id="doc-9", listing_id=other_listing, storage_path="other/doc-9.pdf")
    storage = _FakeStorage({"other/doc-9.pdf": b"%PDF-fake"})
    app = _make_app(
        listing_repo=_FakeListingRepo(
            {listing_id: listing_row, other_listing: {"id": other_listing}}
        ),
        document_repo=_FakeDocumentRepo([row]),
        storage=storage,
    )

    client = TestClient(app)
    response = client.get(f"/listings/{listing_id}/documents/doc-9")

    assert response.status_code == 404
    # Storage must not be hit when the doc isn't owned by the listing
    assert storage.downloads == []


def test_download_404_for_missing_listing() -> None:
    storage = _FakeStorage({"any/path.pdf": b"%PDF-fake"})
    row = _row(doc_id="doc-1", listing_id="ghost", storage_path="any/path.pdf")
    app = _make_app(
        listing_repo=_FakeListingRepo({}),
        document_repo=_FakeDocumentRepo([row]),
        storage=storage,
    )

    client = TestClient(app)
    response = client.get("/listings/ghost/documents/doc-1")

    assert response.status_code == 404
    assert storage.downloads == []


def test_download_uses_rfc5987_for_non_ascii_filename(
    listing_id: str, listing_row: dict[str, Any]
) -> None:
    filename = "Energimærke.pdf"
    row = _row(
        doc_id="doc-7",
        listing_id=listing_id,
        filename=filename,
        storage_path=f"{listing_id}/doc-7.pdf",
    )
    storage = _FakeStorage({f"{listing_id}/doc-7.pdf": b"%PDF-1.4"})
    app = _make_app(
        listing_repo=_FakeListingRepo({listing_id: listing_row}),
        document_repo=_FakeDocumentRepo([row]),
        storage=storage,
    )

    client = TestClient(app)
    response = client.get(f"/listings/{listing_id}/documents/doc-7")

    assert response.status_code == 200
    disposition = response.headers["content-disposition"]
    # ASCII fallback present (æ → '?')
    assert 'filename="' in disposition
    # RFC 5987 encoded form
    assert f"filename*=UTF-8''{quote(filename, safe='')}" in disposition
