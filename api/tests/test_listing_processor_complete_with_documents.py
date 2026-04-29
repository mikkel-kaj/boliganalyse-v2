"""Tests for `ListingProcessorService.complete_with_documents`."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from src.providers.base import BaseProvider
from src.providers.registry import ProviderNotFoundError
from src.services.listing_processor import ListingProcessorService
from src.types.models import HTMLParseResult, ListingDocumentRow, NewListingDocument
from src.types.status import AnalysisStatus

_LISTING_ID = "33333333-3333-3333-3333-333333333333"
_LISTING_URL = "https://home.dk/villa/eksempelvej-1-9000-aalborg/12345"
_HTML = "<html><body>Cached Home listing HTML</body></html>"
_DOC_URL_A = "https://home.mindworking.eu/api/Public/Documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_DOC_URL_B = "https://home.mindworking.eu/api/Public/Documents/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


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
    def __init__(self, listing: dict[str, Any] | None) -> None:
        self._listing = listing
        self.statuses: list[str] = []
        self.saved_analysis: dict[str, Any] | None = None
        self.errors: list[tuple[str, str]] = []

    async def get_by_id(self, listing_id: str) -> dict[str, Any] | None:
        return self._listing

    async def update_status(
        self,
        listing_id: str,
        status: AnalysisStatus,
        error_message: str | None = None,
    ) -> None:
        self.statuses.append(status.value)

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


class _FakeHomeProvider(BaseProvider):
    @property
    def name(self) -> str:
        return "Home.dk"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return True

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        return HTMLParseResult(
            extracted_text="Re-parsed cached text",
            property_image_url=None,
            original_link=None,
        )


class _FakeRegistry:
    def __init__(self, provider: BaseProvider | None) -> None:
        self._provider = provider

    def get_provider_for_content(self, url: str, html_content: str) -> BaseProvider:
        if self._provider is None:
            raise ProviderNotFoundError("none")
        return self._provider


class _FakeAnalyzer:
    def __init__(self) -> None:
        self.calls: list[tuple[str | None, str | None]] = []

    async def analyze_multiple_texts(
        self,
        primary: HTMLParseResult,
        secondary: HTMLParseResult | None,
    ) -> dict[str, Any]:
        self.calls.append(
            (primary.extracted_text, secondary.extracted_text if secondary else None)
        )
        return {"verdict": "ok"}


def _listing_row(status: AnalysisStatus = AnalysisStatus.AWAITING_DOCUMENTS) -> dict[str, Any]:
    return {
        "id": _LISTING_ID,
        "url": _LISTING_URL,
        "status": status.value,
        "html_primary": _HTML,
        "text_primary": "primary text",
    }


def _make_service(
    *,
    listing_repo: _FakeListingRepo,
    analyzer: _FakeAnalyzer,
    doc_repo: _FakeDocRepo,
    storage: _FakeStorage,
    mindworking: _FakeMindworking,
    provider: BaseProvider | None = None,
) -> ListingProcessorService:
    return ListingProcessorService(
        repository=listing_repo,  # type: ignore[arg-type]
        ai_analyzer=analyzer,  # type: ignore[arg-type]
        provider_registry=_FakeRegistry(provider or _FakeHomeProvider()),  # type: ignore[arg-type]
        document_storage=storage,  # type: ignore[arg-type]
        document_repository=doc_repo,  # type: ignore[arg-type]
        mindworking_fetcher=mindworking,
    )


async def test_happy_path_with_source_email_id_tags_documents_as_email() -> None:
    listing_repo = _FakeListingRepo(_listing_row())
    analyzer = _FakeAnalyzer()
    doc_repo = _FakeDocRepo()
    storage = _FakeStorage()
    mw = _FakeMindworking()
    email_id = "99999999-9999-9999-9999-999999999999"

    service = _make_service(
        listing_repo=listing_repo,
        analyzer=analyzer,
        doc_repo=doc_repo,
        storage=storage,
        mindworking=mw,
    )

    ok = await service.complete_with_documents(
        _LISTING_ID, [_DOC_URL_A, _DOC_URL_B], source_email_id=email_id
    )

    assert ok is True
    assert mw.calls == [_DOC_URL_A, _DOC_URL_B]
    assert len(doc_repo.inserted) == 2
    assert all(row.source == "email" for row in doc_repo.inserted)
    assert all(row.source_email_id == email_id for row in doc_repo.inserted)
    assert listing_repo.saved_analysis == {"verdict": "ok"}
    assert AnalysisStatus.PREPARING_ANALYSIS.value in listing_repo.statuses
    assert AnalysisStatus.ANALYZING.value in listing_repo.statuses
    assert AnalysisStatus.GENERATING_INSIGHTS.value in listing_repo.statuses
    assert AnalysisStatus.FINALIZING.value in listing_repo.statuses
    assert analyzer.calls == [("Re-parsed cached text", None)]
    assert listing_repo.errors == []


async def test_happy_path_without_source_email_id_keeps_scrape_source() -> None:
    listing_repo = _FakeListingRepo(_listing_row())
    analyzer = _FakeAnalyzer()
    doc_repo = _FakeDocRepo()
    storage = _FakeStorage()
    mw = _FakeMindworking()

    service = _make_service(
        listing_repo=listing_repo,
        analyzer=analyzer,
        doc_repo=doc_repo,
        storage=storage,
        mindworking=mw,
    )

    ok = await service.complete_with_documents(
        _LISTING_ID, [_DOC_URL_A, _DOC_URL_B]
    )

    assert ok is True
    assert len(doc_repo.inserted) == 2
    assert all(row.source == "scrape" for row in doc_repo.inserted)
    assert all(row.source_email_id is None for row in doc_repo.inserted)
    assert listing_repo.saved_analysis == {"verdict": "ok"}


async def test_listing_already_completed_returns_false() -> None:
    listing_repo = _FakeListingRepo(_listing_row(AnalysisStatus.COMPLETED))
    analyzer = _FakeAnalyzer()
    doc_repo = _FakeDocRepo()
    storage = _FakeStorage()
    mw = _FakeMindworking()

    service = _make_service(
        listing_repo=listing_repo,
        analyzer=analyzer,
        doc_repo=doc_repo,
        storage=storage,
        mindworking=mw,
    )

    ok = await service.complete_with_documents(_LISTING_ID, [_DOC_URL_A])

    assert ok is False
    assert mw.calls == []
    assert doc_repo.inserted == []
    assert analyzer.calls == []
    assert listing_repo.saved_analysis is None
    assert listing_repo.errors == []


async def test_missing_listing_returns_false() -> None:
    listing_repo = _FakeListingRepo(None)
    analyzer = _FakeAnalyzer()
    doc_repo = _FakeDocRepo()
    storage = _FakeStorage()
    mw = _FakeMindworking()

    service = _make_service(
        listing_repo=listing_repo,
        analyzer=analyzer,
        doc_repo=doc_repo,
        storage=storage,
        mindworking=mw,
    )

    ok = await service.complete_with_documents(_LISTING_ID, [_DOC_URL_A])

    assert ok is False
    assert analyzer.calls == []


async def test_no_documents_still_runs_analysis() -> None:
    listing_repo = _FakeListingRepo(_listing_row())
    analyzer = _FakeAnalyzer()
    doc_repo = _FakeDocRepo()
    storage = _FakeStorage()
    mw = _FakeMindworking()

    service = _make_service(
        listing_repo=listing_repo,
        analyzer=analyzer,
        doc_repo=doc_repo,
        storage=storage,
        mindworking=mw,
    )

    ok = await service.complete_with_documents(_LISTING_ID, [])

    assert ok is True
    assert mw.calls == []
    assert doc_repo.inserted == []
    assert listing_repo.saved_analysis == {"verdict": "ok"}
