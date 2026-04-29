"""Integration test for the listing processor's Danbolig document hook.

Drives `process_listing` end-to-end with fakes for the listing repository,
provider registry, AI analyzer, document storage, document repository,
and Mindworking fetcher — proving the documents step runs after parse
and persists the extracted refs.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from src.providers.base import BaseProvider
from src.providers.registry import ProviderNotFoundError
from src.services.listing_processor import ListingProcessorService
from src.types.models import (
    HTMLParseResult,
    ListingDocumentRow,
    NewListingDocument,
)
from src.types.status import AnalysisStatus

_FIXTURE = Path(__file__).parent / "fixtures" / "danbolig_listing.html"
_LISTING_ID = "11111111-1111-1111-1111-111111111111"
_LISTING_URL = "https://www.danbolig.dk/eksempelvej-1-9000-aalborg/4860001679"


@dataclass
class _FetchedDoc:
    content: bytes
    filename: str
    content_type: str
    sha256: str


class _FakeMindworking:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def fetch_document(self, url: str) -> _FetchedDoc:
        self.calls.append(url)
        body = f"%PDF-{url[-4:]}".encode()
        return _FetchedDoc(
            content=body,
            filename=f"{url[-4:]}.pdf",
            content_type="application/pdf",
            sha256=hashlib.sha256(body).hexdigest(),
        )


class _FakeStorage:
    bucket = "documents"

    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes, str]] = []

    async def upload(self, path: str, content: bytes, content_type: str) -> None:
        self.uploads.append((path, content, content_type))


class _FakeDocRepo:
    def __init__(self) -> None:
        self.inserted: list[NewListingDocument] = []
        self._next_id = 1

    async def find_by_listing_and_sha(
        self, listing_id: str, sha: str
    ) -> ListingDocumentRow | None:
        return None

    async def insert(self, row: NewListingDocument) -> ListingDocumentRow:
        self.inserted.append(row)
        rid = f"doc-{self._next_id}"
        self._next_id += 1
        return ListingDocumentRow(
            id=rid,
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


class _FakeListingRepo:
    def __init__(self) -> None:
        self.statuses: list[str] = []
        self.metadata_calls: list[dict[str, Any]] = []
        self.saved_analysis: dict[str, Any] | None = None
        self.errors: list[tuple[str, str]] = []

    async def update_status(
        self,
        listing_id: str,
        status: AnalysisStatus,
        error_message: str | None = None,
    ) -> None:
        self.statuses.append(status.value)

    async def update_listing_metadata(self, listing_id: str, **kwargs: Any) -> None:
        self.metadata_calls.append(kwargs)

    async def save_analysis_result(
        self,
        listing_id: str,
        analysis: dict[str, Any],
        status: AnalysisStatus = AnalysisStatus.COMPLETED,
    ) -> None:
        self.saved_analysis = analysis

    async def set_error_status(
        self,
        listing_id: str,
        error: BaseException | str,
        status: AnalysisStatus = AnalysisStatus.ERROR,
    ) -> None:
        message = (
            f"{type(error).__name__}: {error}"
            if isinstance(error, BaseException)
            else str(error)
        )
        self.errors.append((status.value, message))


class _FakeDanboligProvider(BaseProvider):
    @property
    def name(self) -> str:
        return "Danbolig"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return "danbolig.dk" in url

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        return HTMLParseResult(
            extracted_text="Eksempelvej 1, 9000 Aalborg",
            property_image_url="https://example.com/image.jpg",
            original_link=None,
        )


class _FakeNonDanboligProvider(BaseProvider):
    @property
    def name(self) -> str:
        return "JSON-LD"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return True

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        return HTMLParseResult(extracted_text="generic listing", original_link=None)


class _FakeRegistry:
    def __init__(self, provider: BaseProvider | None) -> None:
        self._provider = provider

    def get_provider_for_content(self, url: str, html_content: str) -> BaseProvider:
        if self._provider is None:
            raise ProviderNotFoundError("none")
        return self._provider


class _FakeAnalyzer:
    def __init__(self) -> None:
        self.calls = 0

    async def analyze_multiple_texts(
        self,
        primary: HTMLParseResult,
        secondary: HTMLParseResult | None,
    ) -> dict[str, Any]:
        self.calls += 1
        return {"verdict": "ok"}


@pytest.fixture
def fixture_html() -> str:
    return _FIXTURE.read_text(encoding="utf-8")


def _make_service(
    *,
    provider: BaseProvider,
    fixture_html: str,
    listing_repo: _FakeListingRepo,
    doc_storage: _FakeStorage,
    doc_repo: _FakeDocRepo,
    mindworking: _FakeMindworking,
    monkeypatch: pytest.MonkeyPatch,
) -> ListingProcessorService:
    async def _fake_fetch(url: str) -> str:
        return fixture_html

    monkeypatch.setattr(ListingProcessorService, "_fetch_html", staticmethod(_fake_fetch))

    return ListingProcessorService(
        repository=listing_repo,  # type: ignore[arg-type]
        ai_analyzer=_FakeAnalyzer(),  # type: ignore[arg-type]
        provider_registry=_FakeRegistry(provider),  # type: ignore[arg-type]
        document_storage=doc_storage,  # type: ignore[arg-type]
        document_repository=doc_repo,  # type: ignore[arg-type]
        mindworking_fetcher=mindworking,
    )


async def test_danbolig_documents_get_ingested(
    fixture_html: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    listing_repo = _FakeListingRepo()
    doc_storage = _FakeStorage()
    doc_repo = _FakeDocRepo()
    mw = _FakeMindworking()

    service = _make_service(
        provider=_FakeDanboligProvider(),
        fixture_html=fixture_html,
        listing_repo=listing_repo,
        doc_storage=doc_storage,
        doc_repo=doc_repo,
        mindworking=mw,
        monkeypatch=monkeypatch,
    )

    ok = await service.process_listing(_LISTING_ID, _LISTING_URL)

    assert ok is True
    # Both documents in the fixture get fetched, uploaded, and inserted.
    assert len(mw.calls) == 2
    assert len(doc_storage.uploads) == 2
    assert len(doc_repo.inserted) == 2
    assert {row.kind for row in doc_repo.inserted} == {
        "Salgsopstilling - Villa",
        "Energimærke, gældende",
    }
    assert all(row.source == "scrape" for row in doc_repo.inserted)
    # Analysis still runs, listing reaches COMPLETED.
    assert listing_repo.saved_analysis == {"verdict": "ok"}


async def test_non_danbolig_provider_skips_documents(
    fixture_html: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    listing_repo = _FakeListingRepo()
    doc_storage = _FakeStorage()
    doc_repo = _FakeDocRepo()
    mw = _FakeMindworking()

    service = _make_service(
        provider=_FakeNonDanboligProvider(),
        fixture_html=fixture_html,
        listing_repo=listing_repo,
        doc_storage=doc_storage,
        doc_repo=doc_repo,
        mindworking=mw,
        monkeypatch=monkeypatch,
    )

    ok = await service.process_listing(_LISTING_ID, _LISTING_URL)

    assert ok is True
    assert mw.calls == []
    assert doc_storage.uploads == []
    assert doc_repo.inserted == []
    assert listing_repo.saved_analysis == {"verdict": "ok"}


async def test_document_failure_does_not_break_pipeline(
    fixture_html: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    listing_repo = _FakeListingRepo()
    doc_storage = _FakeStorage()
    doc_repo = _FakeDocRepo()

    class _AlwaysFails(_FakeMindworking):
        async def fetch_document(self, url: str) -> _FetchedDoc:
            raise RuntimeError("network down")

    service = _make_service(
        provider=_FakeDanboligProvider(),
        fixture_html=fixture_html,
        listing_repo=listing_repo,
        doc_storage=doc_storage,
        doc_repo=doc_repo,
        mindworking=_AlwaysFails(),
        monkeypatch=monkeypatch,
    )

    ok = await service.process_listing(_LISTING_ID, _LISTING_URL)

    assert ok is True
    assert doc_repo.inserted == []
    assert doc_storage.uploads == []
    # Analysis still runs.
    assert listing_repo.saved_analysis == {"verdict": "ok"}
    assert listing_repo.errors == []
