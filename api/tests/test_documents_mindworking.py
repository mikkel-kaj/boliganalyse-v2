"""Unit tests for the Mindworking public-document fetcher.

Uses `httpx.MockTransport` to stub HTTP responses without hitting the
real Mindworking servers.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable

import httpx
import pytest

from src.documents import mindworking
from src.documents.mindworking import (
    FetchedDocument,
    MindworkingFetchError,
    fetch_document,
)

PDF_BYTES = b"%PDF-1.4\nfake content\n%%EOF"
DANBOLIG_URL = (
    "https://danbolig.mindworking.eu/api/Public/Documents/"
    "26d87892-deb1-44b4-bc6d-549702714284"
)


def _patch_transport(
    monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    """Replace `httpx.AsyncClient` so the fetcher uses a `MockTransport`."""
    transport = httpx.MockTransport(handler)
    real_init = httpx.AsyncClient.__init__

    def patched(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs["transport"] = transport
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched)


async def test_happy_path_returns_fetched_document(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == DANBOLIG_URL
        return httpx.Response(
            200,
            content=PDF_BYTES,
            headers={
                "content-type": "application/pdf",
                "content-disposition": (
                    "inline; filename*=utf-8''Salgsopstilling_villa_211_1296747.pdf"
                ),
            },
        )

    _patch_transport(monkeypatch, handler)

    doc = await fetch_document(DANBOLIG_URL)

    assert isinstance(doc, FetchedDocument)
    assert doc.content == PDF_BYTES
    assert doc.filename == "Salgsopstilling_villa_211_1296747.pdf"
    assert doc.content_type == "application/pdf"
    assert doc.sha256 == hashlib.sha256(PDF_BYTES).hexdigest()


async def test_non_mindworking_host_raises_value_error() -> None:
    with pytest.raises(ValueError, match="non-mindworking host"):
        await fetch_document("https://evil.example.com/document.pdf")


async def test_bare_mindworking_host_rejected() -> None:
    # The validator accepts only `*.mindworking.eu`, not the bare domain.
    with pytest.raises(ValueError, match="non-mindworking host"):
        await fetch_document("https://mindworking.eu/api/Public/Documents/abc")


async def test_alternative_mindworking_subdomain_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=PDF_BYTES,
            headers={
                "content-type": "application/pdf",
                "content-disposition": 'attachment; filename="x.pdf"',
            },
        )

    _patch_transport(monkeypatch, handler)

    doc = await fetch_document(
        "https://home.mindworking.eu/api/Public/Documents/whatever"
    )
    assert doc.filename == "x.pdf"


async def test_404_raises_fetch_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text="not found")

    _patch_transport(monkeypatch, handler)

    with pytest.raises(MindworkingFetchError) as excinfo:
        await fetch_document(DANBOLIG_URL)
    assert excinfo.value.status == 404


async def test_oversize_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mindworking, "_MAX_BYTES", 16)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"x" * 64,
            headers={"content-type": "application/pdf"},
        )

    _patch_transport(monkeypatch, handler)

    with pytest.raises(MindworkingFetchError, match="exceeds"):
        await fetch_document(DANBOLIG_URL)


async def test_unexpected_content_type_raises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b"<html>not a pdf</html>",
            headers={"content-type": "text/html; charset=utf-8"},
        )

    _patch_transport(monkeypatch, handler)

    with pytest.raises(MindworkingFetchError, match="content-type"):
        await fetch_document(DANBOLIG_URL)


async def test_filename_falls_back_to_url_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=PDF_BYTES,
            headers={"content-type": "application/pdf"},
        )

    _patch_transport(monkeypatch, handler)

    doc = await fetch_document(
        "https://danbolig.mindworking.eu/api/Public/Documents/abc-guid-123"
    )
    assert doc.filename == "abc-guid-123"


async def test_filename_quoted_plain_form(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=PDF_BYTES,
            headers={
                "content-type": "application/pdf",
                "content-disposition": 'attachment; filename="Tilstandsrapport.pdf"',
            },
        )

    _patch_transport(monkeypatch, handler)

    doc = await fetch_document(DANBOLIG_URL)
    assert doc.filename == "Tilstandsrapport.pdf"


async def test_filename_utf8_percent_encoded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # `Energimærke.pdf` percent-encoded as utf-8.
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=PDF_BYTES,
            headers={
                "content-type": "application/pdf",
                "content-disposition": (
                    "inline; filename*=utf-8''Energim%C3%A6rke.pdf"
                ),
            },
        )

    _patch_transport(monkeypatch, handler)

    doc = await fetch_document(DANBOLIG_URL)
    assert doc.filename == "Energimærke.pdf"
