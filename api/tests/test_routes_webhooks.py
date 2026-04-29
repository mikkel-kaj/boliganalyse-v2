"""Integration tests for the inbound-email webhook route.

Stubs out repositories and the listing processor's `complete_with_documents`
so the test suite stays hermetic — no live Supabase, no live HTTP."""

from __future__ import annotations

from pathlib import Path
from typing import Any, ClassVar

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.config import get_settings
from src.routes import webhooks as webhooks_route
from src.routes.dependencies import (
    get_inbound_email_repository,
    get_repository,
)
from src.services import listing_processor as listing_processor_module
from src.types.models import InboundEmailRow

_FIXTURE = Path(__file__).parent / "fixtures" / "home_salesmaterial.eml"
_SECRET = "test-secret"


@pytest.fixture(autouse=True)
def _set_inbound_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "http://kong:8000")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("INBOUND_EMAIL_SECRET", _SECRET)
    get_settings.cache_clear()


class _FakeInboundEmailRepo:
    def __init__(self) -> None:
        self.inserts: list[dict[str, Any]] = []
        self.status_updates: list[tuple[str, str, str | None]] = []
        self._next_id = 1

    async def insert(
        self,
        *,
        inbox_local_part: str,
        status: str,
        listing_id: str | None = None,
        from_address: str | None = None,
        subject: str | None = None,
        raw_storage_path: str | None = None,
        error_message: str | None = None,
    ) -> InboundEmailRow:
        rid = f"email-{self._next_id}"
        self._next_id += 1
        self.inserts.append(
            {
                "id": rid,
                "inbox_local_part": inbox_local_part,
                "status": status,
                "listing_id": listing_id,
                "from_address": from_address,
                "subject": subject,
                "error_message": error_message,
            }
        )
        return InboundEmailRow(
            id=rid,
            inbox_local_part=inbox_local_part,
            listing_id=listing_id,
            from_address=from_address,
            subject=subject,
            raw_storage_path=raw_storage_path,
            status=status,
            error_message=error_message,
            received_at="2026-04-29T12:00:00+00:00",
        )

    async def update_status(
        self, email_id: str, status: str, error_message: str | None = None
    ) -> None:
        self.status_updates.append((email_id, status, error_message))


class _FakeListingRepo:
    """Just enough surface for `ListingProcessorService` to be constructed
    — the real method is monkeypatched away in tests that exercise the
    matched-listing path."""

    pass


class _RecordingProcessor:
    """Captures complete_with_documents calls. Patched onto
    `ListingProcessorService` so the webhook route can construct one."""

    instances: ClassVar[list[_RecordingProcessor]] = []

    def __init__(self, repository: Any) -> None:
        self.repository = repository
        self.calls: list[tuple[str, list[str], str | None]] = []
        self.return_value: bool = True
        self.raise_exc: BaseException | None = None
        type(self).instances.append(self)

    async def complete_with_documents(
        self,
        listing_id: str,
        document_urls: list[str],
        *,
        source_email_id: str | None = None,
    ) -> bool:
        self.calls.append((listing_id, document_urls, source_email_id))
        if self.raise_exc is not None:
            raise self.raise_exc
        return self.return_value


def _make_app(
    *,
    listing_repo: _FakeListingRepo,
    email_repo: _FakeInboundEmailRepo,
) -> FastAPI:
    app = FastAPI()
    app.include_router(webhooks_route.router)
    app.dependency_overrides[get_repository] = lambda: listing_repo
    app.dependency_overrides[get_inbound_email_repository] = lambda: email_repo
    return app


@pytest.fixture(autouse=True)
def _patch_processor(monkeypatch: pytest.MonkeyPatch) -> None:
    _RecordingProcessor.instances = []
    monkeypatch.setattr(
        listing_processor_module, "ListingProcessorService", _RecordingProcessor
    )
    # The route imports the symbol directly; patch there too.
    monkeypatch.setattr(
        webhooks_route, "ListingProcessorService", _RecordingProcessor
    )


def test_401_without_secret() -> None:
    app = _make_app(
        listing_repo=_FakeListingRepo(),
        email_repo=_FakeInboundEmailRepo(),
    )
    client = TestClient(app)

    response = client.post(
        "/webhooks/inbound-email",
        content=_FIXTURE.read_bytes(),
        headers={"Content-Type": "message/rfc822"},
    )

    assert response.status_code == 401


def test_401_with_wrong_secret() -> None:
    app = _make_app(
        listing_repo=_FakeListingRepo(),
        email_repo=_FakeInboundEmailRepo(),
    )
    client = TestClient(app)

    response = client.post(
        "/webhooks/inbound-email",
        content=_FIXTURE.read_bytes(),
        headers={
            "Content-Type": "message/rfc822",
            "X-Inbound-Secret": "wrong",
        },
    )

    assert response.status_code == 401


def test_matched_email_resumes_pipeline_and_returns_ok() -> None:
    email_repo = _FakeInboundEmailRepo()
    app = _make_app(listing_repo=_FakeListingRepo(), email_repo=email_repo)
    client = TestClient(app)

    response = client.post(
        "/webhooks/inbound-email",
        content=_FIXTURE.read_bytes(),
        headers={
            "Content-Type": "message/rfc822",
            "X-Inbound-Secret": _SECRET,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    inbound_id = body["inbound_email_id"]
    assert inbound_id

    # Row inserted as 'received', then 'matched', then 'parsed'.
    assert len(email_repo.inserts) == 1
    assert email_repo.inserts[0]["status"] == "received"
    assert email_repo.inserts[0]["listing_id"] == "00000000-0000-0000-0000-000000000001"
    assert email_repo.inserts[0]["from_address"] == "noreply@myhome.home.dk"
    statuses = [s for (_, s, _) in email_repo.status_updates]
    assert statuses == ["matched", "parsed"]

    # Pipeline resume was called exactly once with all 3 doc URLs and the
    # inbound email's id forwarded as source_email_id (so docs land with
    # source='email' linked back to the email row).
    assert len(_RecordingProcessor.instances) == 1
    proc = _RecordingProcessor.instances[0]
    assert len(proc.calls) == 1
    listing_id, doc_urls, source_email_id = proc.calls[0]
    assert listing_id == "00000000-0000-0000-0000-000000000001"
    assert len(doc_urls) == 3
    assert source_email_id == inbound_id


def test_unmatched_local_part_returns_ignored() -> None:
    email_repo = _FakeInboundEmailRepo()
    app = _make_app(listing_repo=_FakeListingRepo(), email_repo=email_repo)
    client = TestClient(app)

    raw = (
        b"From: noreply@example.com\r\n"
        b"To: support@inbox.boliganalyse.ai\r\n"
        b"Subject: Hi\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Body\r\n"
    )

    response = client.post(
        "/webhooks/inbound-email",
        content=raw,
        headers={
            "Content-Type": "message/rfc822",
            "X-Inbound-Secret": _SECRET,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ignored"
    assert body["reason"] == "unmatched local part"

    assert len(email_repo.inserts) == 1
    assert email_repo.inserts[0]["status"] == "received"
    assert email_repo.inserts[0]["listing_id"] is None
    statuses = [s for (_, s, _) in email_repo.status_updates]
    assert statuses == ["unmatched"]

    # Pipeline must not run for unmatched mail.
    assert _RecordingProcessor.instances == []


def test_matched_email_with_no_urls_returns_ignored() -> None:
    email_repo = _FakeInboundEmailRepo()
    app = _make_app(listing_repo=_FakeListingRepo(), email_repo=email_repo)
    client = TestClient(app)

    raw = (
        b"From: noreply@myhome.home.dk\r\n"
        b"To: 00000000-0000-0000-0000-000000000099@inbox.boliganalyse.ai\r\n"
        b"Subject: Hello\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n"
        b"\r\n"
        b"Just a message - no document links here.\r\n"
    )

    response = client.post(
        "/webhooks/inbound-email",
        content=raw,
        headers={
            "Content-Type": "message/rfc822",
            "X-Inbound-Secret": _SECRET,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ignored"
    assert body["reason"] == "no documents"

    statuses = [s for (_, s, _) in email_repo.status_updates]
    assert statuses == ["matched"]
    assert _RecordingProcessor.instances == []
