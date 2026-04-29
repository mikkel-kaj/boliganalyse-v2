"""Integration test for the listing processor's Home.dk lead-submission hook.

Drives `process_listing` end-to-end with fakes, proving the lead form is
submitted after parse for Home listings, the pipeline halts in
`awaiting_documents`, and the AI analyzer is skipped. Failure modes
(metadata None, submitter raises) fall back to the normal analysis flow.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.documents.submitters.home import HomeLeadSubmissionError
from src.providers.base import BaseProvider
from src.providers.registry import ProviderNotFoundError
from src.services.listing_processor import ListingProcessorService
from src.types.models import HomeLeadIdentity, HomeListingMetadata, HTMLParseResult
from src.types.status import AnalysisStatus

_LISTING_ID = "22222222-2222-2222-2222-222222222222"
_LISTING_URL = "https://home.dk/villa/eksempelvej-1-9000-aalborg/12345"
_HTML = "<html><body>Home listing</body></html>"


class _FakeListingRepo:
    def __init__(self) -> None:
        self.statuses: list[str] = []
        self.metadata_calls: list[dict[str, Any]] = []
        self.saved_analysis: dict[str, Any] | None = None
        self.errors: list[tuple[str, str]] = []
        self.email_lead_sent_for: list[str] = []

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

    async def set_email_lead_sent(self, listing_id: str) -> None:
        self.email_lead_sent_for.append(listing_id)


class _FakeHomeProvider(BaseProvider):
    @property
    def name(self) -> str:
        return "Home.dk"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return "home.dk" in url

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        return HTMLParseResult(
            extracted_text="Eksempelvej 1, 9000 Aalborg",
            property_image_url="https://example.com/image.jpg",
            original_link=url,
        )


class _FakeDanboligProvider(BaseProvider):
    @property
    def name(self) -> str:
        return "Danbolig"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return "danbolig.dk" in url

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        return HTMLParseResult(
            extracted_text="Some Danbolig listing",
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
        self.calls = 0

    async def analyze_multiple_texts(
        self,
        primary: HTMLParseResult,
        secondary: HTMLParseResult | None,
    ) -> dict[str, Any]:
        self.calls += 1
        return {"verdict": "ok"}


class _RecordingSubmitter:
    def __init__(self, *, raise_exc: BaseException | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self._raise_exc = raise_exc

    async def __call__(
        self,
        metadata: HomeListingMetadata,
        *,
        listing_id: str,
        identity: HomeLeadIdentity,
        inbox_domain: str,
    ) -> None:
        self.calls.append(
            {
                "metadata": metadata,
                "listing_id": listing_id,
                "identity": identity,
                "inbox_domain": inbox_domain,
            }
        )
        if self._raise_exc is not None:
            raise self._raise_exc


def _make_service(
    *,
    provider: BaseProvider,
    listing_repo: _FakeListingRepo,
    analyzer: _FakeAnalyzer,
    submitter: _RecordingSubmitter,
    metadata_extractor: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> ListingProcessorService:
    async def _fake_fetch(url: str) -> str:
        return _HTML

    monkeypatch.setattr(
        ListingProcessorService, "_fetch_html", staticmethod(_fake_fetch)
    )

    return ListingProcessorService(
        repository=listing_repo,  # type: ignore[arg-type]
        ai_analyzer=analyzer,  # type: ignore[arg-type]
        provider_registry=_FakeRegistry(provider),  # type: ignore[arg-type]
        home_submitter=submitter,
        home_metadata_extractor=metadata_extractor,
    )


async def test_home_lead_submitted_and_pipeline_halts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listing_repo = _FakeListingRepo()
    analyzer = _FakeAnalyzer()
    submitter = _RecordingSubmitter()
    metadata = HomeListingMetadata(store_id="123", case_number="ABC")

    def _extractor(html: str) -> HomeListingMetadata:
        return metadata

    service = _make_service(
        provider=_FakeHomeProvider(),
        listing_repo=listing_repo,
        analyzer=analyzer,
        submitter=submitter,
        metadata_extractor=_extractor,
        monkeypatch=monkeypatch,
    )

    ok = await service.process_listing(_LISTING_ID, _LISTING_URL)

    assert ok is True
    assert analyzer.calls == 0
    assert listing_repo.saved_analysis is None
    assert listing_repo.email_lead_sent_for == [_LISTING_ID]
    assert listing_repo.metadata_calls == []
    assert listing_repo.errors == []
    assert len(submitter.calls) == 1
    call = submitter.calls[0]
    assert call["metadata"] is metadata
    assert call["listing_id"] == _LISTING_ID
    assert isinstance(call["identity"], HomeLeadIdentity)
    assert isinstance(call["inbox_domain"], str) and call["inbox_domain"]


async def test_home_metadata_none_falls_back_to_analysis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listing_repo = _FakeListingRepo()
    analyzer = _FakeAnalyzer()
    submitter = _RecordingSubmitter()

    def _extractor(html: str) -> None:
        return None

    service = _make_service(
        provider=_FakeHomeProvider(),
        listing_repo=listing_repo,
        analyzer=analyzer,
        submitter=submitter,
        metadata_extractor=_extractor,
        monkeypatch=monkeypatch,
    )

    ok = await service.process_listing(_LISTING_ID, _LISTING_URL)

    assert ok is True
    assert submitter.calls == []
    assert analyzer.calls == 1
    assert listing_repo.saved_analysis == {"verdict": "ok"}
    assert listing_repo.email_lead_sent_for == []


async def test_home_submitter_failure_falls_back_to_analysis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listing_repo = _FakeListingRepo()
    analyzer = _FakeAnalyzer()
    submitter = _RecordingSubmitter(
        raise_exc=HomeLeadSubmissionError(500, "boom")
    )
    metadata = HomeListingMetadata(store_id="123", case_number="ABC")

    def _extractor(html: str) -> HomeListingMetadata:
        return metadata

    service = _make_service(
        provider=_FakeHomeProvider(),
        listing_repo=listing_repo,
        analyzer=analyzer,
        submitter=submitter,
        metadata_extractor=_extractor,
        monkeypatch=monkeypatch,
    )

    ok = await service.process_listing(_LISTING_ID, _LISTING_URL)

    assert ok is True
    assert len(submitter.calls) == 1
    assert listing_repo.email_lead_sent_for == []
    assert analyzer.calls == 1
    assert listing_repo.saved_analysis == {"verdict": "ok"}


async def test_non_home_provider_skips_lead_submission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listing_repo = _FakeListingRepo()
    analyzer = _FakeAnalyzer()
    submitter = _RecordingSubmitter()

    def _extractor(html: str) -> HomeListingMetadata:
        raise AssertionError("metadata extractor should not run for non-Home providers")

    service = _make_service(
        provider=_FakeDanboligProvider(),
        listing_repo=listing_repo,
        analyzer=analyzer,
        submitter=submitter,
        metadata_extractor=_extractor,
        monkeypatch=monkeypatch,
    )

    ok = await service.process_listing(_LISTING_ID, _LISTING_URL)

    assert ok is True
    assert submitter.calls == []
    assert analyzer.calls == 1
    assert listing_repo.email_lead_sent_for == []
    assert listing_repo.saved_analysis == {"verdict": "ok"}
