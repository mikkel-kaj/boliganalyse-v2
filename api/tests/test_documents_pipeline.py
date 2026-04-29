"""Async tests for `ingest_documents`. Uses fakes for mindworking +
storage + repo so the test suite stays hermetic."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from src.documents.pipeline import ingest_documents
from src.types.models import DocumentRef, ListingDocumentRow, NewListingDocument


@dataclass
class _FetchedDoc:
    content: bytes
    filename: str
    content_type: str
    sha256: str


class _FakeMindworking:
    def __init__(self, responses: dict[str, _FetchedDoc | Exception]) -> None:
        self._responses = responses
        self.calls: list[str] = []

    async def fetch_document(self, url: str) -> _FetchedDoc:
        self.calls.append(url)
        result = self._responses[url]
        if isinstance(result, Exception):
            raise result
        return result


class _FakeStorage:
    bucket = "documents"

    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes, str]] = []

    async def upload(self, path: str, content: bytes, content_type: str) -> None:
        self.uploads.append((path, content, content_type))


class _FakeRepo:
    def __init__(self) -> None:
        self.inserted: list[NewListingDocument] = []
        self._existing_by_sha: dict[tuple[str, str], ListingDocumentRow] = {}
        self._next_id = 1

    def seed_existing(self, listing_id: str, sha: str) -> ListingDocumentRow:
        row = self._make_row(
            NewListingDocument(
                listing_id=listing_id,
                source="scrape",
                filename="prev.pdf",
                content_type="application/pdf",
                size_bytes=10,
                sha256=sha,
                storage_path=f"{listing_id}/{sha}.pdf",
            )
        )
        self._existing_by_sha[(listing_id, sha)] = row
        return row

    async def find_by_listing_and_sha(
        self, listing_id: str, sha: str
    ) -> ListingDocumentRow | None:
        return self._existing_by_sha.get((listing_id, sha))

    async def insert(self, row: NewListingDocument) -> ListingDocumentRow:
        self.inserted.append(row)
        full_row = self._make_row(row)
        self._existing_by_sha[(row.listing_id, row.sha256)] = full_row
        return full_row

    def _make_row(self, row: NewListingDocument) -> ListingDocumentRow:
        new_id = f"doc-{self._next_id}"
        self._next_id += 1
        return ListingDocumentRow(
            id=new_id,
            listing_id=row.listing_id,
            source=row.source,
            filename=row.filename,
            content_type=row.content_type,
            size_bytes=row.size_bytes,
            sha256=row.sha256,
            storage_bucket=row.storage_bucket,
            storage_path=row.storage_path,
            kind=row.kind,
            source_url=row.source_url,
            source_email_id=row.source_email_id,
            created_at="2026-04-29T12:00:00+00:00",
        )


def _ref(url: str, *, name: str = "Doc", kind: str = "Salgsopstilling") -> DocumentRef:
    return DocumentRef(url=url, filename_hint=name, kind=kind, source_url=url)


def _fetched(content: bytes, filename: str = "x.pdf") -> _FetchedDoc:
    return _FetchedDoc(
        content=content,
        filename=filename,
        content_type="application/pdf",
        sha256=hashlib.sha256(content).hexdigest(),
    )


_LISTING_ID = "11111111-1111-1111-1111-111111111111"
_URL_A = "https://danbolig.mindworking.eu/api/Public/Documents/aaaa"
_URL_B = "https://danbolig.mindworking.eu/api/Public/Documents/bbbb"


async def test_happy_path_inserts_two_rows() -> None:
    fetched_a = _fetched(b"%PDF-A", "salgsopstilling.pdf")
    fetched_b = _fetched(b"%PDF-B", "energimaerke.pdf")
    mw = _FakeMindworking({_URL_A: fetched_a, _URL_B: fetched_b})
    storage = _FakeStorage()
    repo = _FakeRepo()

    rows = await ingest_documents(
        _LISTING_ID,
        [_ref(_URL_A), _ref(_URL_B, name="Energimærke", kind="Energimærke, gældende")],
        mindworking=mw,
        storage=storage,
        repo=repo,
    )

    assert len(rows) == 2
    assert {r.filename for r in rows} == {"salgsopstilling.pdf", "energimaerke.pdf"}
    assert mw.calls == [_URL_A, _URL_B]
    assert len(storage.uploads) == 2
    assert storage.uploads[0][0] == f"{_LISTING_ID}/{fetched_a.sha256}.pdf"
    assert storage.uploads[1][0] == f"{_LISTING_ID}/{fetched_b.sha256}.pdf"

    assert len(repo.inserted) == 2
    first = repo.inserted[0]
    assert first.source == "scrape"
    assert first.source_url == _URL_A
    assert first.kind == "Salgsopstilling"
    assert first.storage_bucket == "documents"
    assert first.size_bytes == len(fetched_a.content)


async def test_dedupe_skips_upload_and_insert() -> None:
    fetched_a = _fetched(b"%PDF-A")
    mw = _FakeMindworking({_URL_A: fetched_a})
    storage = _FakeStorage()
    repo = _FakeRepo()
    existing = repo.seed_existing(_LISTING_ID, fetched_a.sha256)

    rows = await ingest_documents(
        _LISTING_ID,
        [_ref(_URL_A)],
        mindworking=mw,
        storage=storage,
        repo=repo,
    )

    assert rows == [existing]
    assert storage.uploads == []
    assert repo.inserted == []


async def test_failed_fetch_does_not_stop_other_documents() -> None:
    good = _fetched(b"%PDF-OK", "good.pdf")
    mw = _FakeMindworking(
        {
            _URL_A: RuntimeError("boom"),
            _URL_B: good,
        }
    )
    storage = _FakeStorage()
    repo = _FakeRepo()

    rows = await ingest_documents(
        _LISTING_ID,
        [_ref(_URL_A), _ref(_URL_B)],
        mindworking=mw,
        storage=storage,
        repo=repo,
    )

    assert len(rows) == 1
    assert rows[0].filename == "good.pdf"
    assert mw.calls == [_URL_A, _URL_B]
    assert len(storage.uploads) == 1
    assert len(repo.inserted) == 1


async def test_failed_upload_does_not_stop_other_documents() -> None:
    a = _fetched(b"%PDF-A", "a.pdf")
    b = _fetched(b"%PDF-B", "b.pdf")
    mw = _FakeMindworking({_URL_A: a, _URL_B: b})
    repo = _FakeRepo()

    class _BrokenStorage(_FakeStorage):
        async def upload(self, path: str, content: bytes, content_type: str) -> None:
            if content == b"%PDF-A":
                raise RuntimeError("storage down")
            await super().upload(path, content, content_type)

    storage = _BrokenStorage()

    rows = await ingest_documents(
        _LISTING_ID,
        [_ref(_URL_A), _ref(_URL_B)],
        mindworking=mw,
        storage=storage,
        repo=repo,
    )

    assert len(rows) == 1
    assert rows[0].filename == "b.pdf"


async def test_empty_refs_returns_empty_list() -> None:
    mw = _FakeMindworking({})
    storage = _FakeStorage()
    repo = _FakeRepo()

    rows = await ingest_documents(
        _LISTING_ID, [], mindworking=mw, storage=storage, repo=repo
    )

    assert rows == []
    assert mw.calls == []
    assert storage.uploads == []
