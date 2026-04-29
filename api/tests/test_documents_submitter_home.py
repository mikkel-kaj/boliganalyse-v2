"""Unit tests for the Home sales-material lead submitter.

Uses ``httpx.MockTransport`` to stub the consent + lead endpoints. Live
calls against ``api.home.dk`` create real leads in a broker's CRM, so
nothing in this file is allowed to leave the host.
"""

from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest

from src.documents.submitters.home import (
    HomeLeadSubmissionError,
    submit_sales_material_lead,
)
from src.types.models import HomeLeadIdentity, HomeListingMetadata

CONSENT_URL = "https://api.home.dk/leads//homedk/leads/SalesMaterial/consent"
LEAD_URL = "https://api.home.dk/leads//homedk/leads/sales-material"

CONSENT_ID = "consent-uuid-7"
CONSENT_PURPOSE_TEXT = "<p>Consent purpose text body</p>"

LISTING_ID = "listing-abc-123"
INBOX_DOMAIN = "inbox.boliganalyse.ai"

METADATA = HomeListingMetadata(store_id="42", case_number="9001")
IDENTITY = HomeLeadIdentity(
    first_name="Boliganalyse",
    last_name="AI",
    phone="+4512345678",
    postal_code="2100",
    privacy_policy_html="<p>privacy policy</p>",
    purpose_text_headline_html="<p><strong>headline</strong></p>",
)


def _patch_transport(
    monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    transport = httpx.MockTransport(handler)
    real_init = httpx.AsyncClient.__init__

    def patched(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs["transport"] = transport
        real_init(self, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched)


def _consent_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "id": "wrapper-id-ignored",
            "current": {
                "id": CONSENT_ID,
                "purposeText": CONSENT_PURPOSE_TEXT,
            },
        },
    )


def _success_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={"isSuccess": True, "isOperationCompleted": True, "errors": []},
    )


async def test_happy_path_returns_none_and_sends_expected_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if request.method == "GET" and url == CONSENT_URL:
            for header in ("User-Agent", "X-Forwarded-Host", "Referer", "Origin"):
                assert header in request.headers
            assert request.headers["X-Forwarded-Host"] == "home.dk"
            captured["consent"] = request
            return _consent_response()
        if request.method == "POST" and url == LEAD_URL:
            assert request.headers["Content-Type"].startswith("application/json")
            captured["lead"] = request
            return _success_response()
        raise AssertionError(f"unexpected request: {request.method} {url}")

    _patch_transport(monkeypatch, handler)

    result = await submit_sales_material_lead(
        METADATA,
        listing_id=LISTING_ID,
        identity=IDENTITY,
        inbox_domain=INBOX_DOMAIN,
    )
    assert result is None

    assert "consent" in captured and "lead" in captured
    body = json.loads(captured["lead"].content.decode("utf-8"))
    assert body["currentConsentId"] == CONSENT_ID
    assert body["storeId"] == METADATA.store_id
    assert body["caseNumber"] == METADATA.case_number
    assert body["firstName"] == IDENTITY.first_name
    assert body["lastName"] == IDENTITY.last_name
    assert body["phoneNumber"] == IDENTITY.phone
    assert body["postalCode"] == IDENTITY.postal_code
    assert body["email"] == f"{LISTING_ID}@{INBOX_DOMAIN}"
    assert body["comment"] == ""
    assert body["hasAcceptedContactFromStore"] is False
    assert body["hasAcceptedMarketing"] is False
    assert body["hasAcceptedRelatedInformation"] is False
    assert body["datasource"] is None
    assert body["projectId"] is None
    assert isinstance(body["consents"], list) and len(body["consents"]) == 1
    consent = body["consents"][0]
    assert consent["type"] == "PurposeText"
    assert consent["privacyPolicy"] == IDENTITY.privacy_policy_html
    assert consent["purposeText"] == (
        IDENTITY.purpose_text_headline_html + CONSENT_PURPOSE_TEXT
    )


async def test_email_uses_listing_id_and_inbox_domain_exactly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return _consent_response()
        body = json.loads(request.content.decode("utf-8"))
        sent["email"] = body["email"]
        return _success_response()

    _patch_transport(monkeypatch, handler)

    await submit_sales_material_lead(
        METADATA,
        listing_id="custom-listing-xyz",
        identity=IDENTITY,
        inbox_domain="mail.example.test",
    )
    assert sent["email"] == "custom-listing-xyz@mail.example.test"


async def test_has_accepted_contact_from_store_is_false(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return _consent_response()
        body = json.loads(request.content.decode("utf-8"))
        sent["body"] = body
        return _success_response()

    _patch_transport(monkeypatch, handler)

    await submit_sales_material_lead(
        METADATA,
        listing_id=LISTING_ID,
        identity=IDENTITY,
        inbox_domain=INBOX_DOMAIN,
    )
    assert sent["body"]["hasAcceptedContactFromStore"] is False  # type: ignore[index]


async def test_consent_get_failure_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="service unavailable")

    _patch_transport(monkeypatch, handler)

    with pytest.raises(HomeLeadSubmissionError) as excinfo:
        await submit_sales_material_lead(
            METADATA,
            listing_id=LISTING_ID,
            identity=IDENTITY,
            inbox_domain=INBOX_DOMAIN,
        )
    assert excinfo.value.status == 503


async def test_lead_post_400_raises_with_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    error_payload = {"errors": [{"code": "INVALID", "message": "bad case"}]}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return _consent_response()
        return httpx.Response(400, json=error_payload)

    _patch_transport(monkeypatch, handler)

    with pytest.raises(HomeLeadSubmissionError) as excinfo:
        await submit_sales_material_lead(
            METADATA,
            listing_id=LISTING_ID,
            identity=IDENTITY,
            inbox_domain=INBOX_DOMAIN,
        )
    assert excinfo.value.status == 400
    assert excinfo.value.body == error_payload


async def test_lead_post_is_success_false_raises_with_body_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    rejection = {
        "isSuccess": False,
        "isOperationCompleted": False,
        "errors": [{"code": "VALIDATION", "message": "missing field"}],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return _consent_response()
        return httpx.Response(200, json=rejection)

    _patch_transport(monkeypatch, handler)

    with pytest.raises(HomeLeadSubmissionError) as excinfo:
        await submit_sales_material_lead(
            METADATA,
            listing_id=LISTING_ID,
            identity=IDENTITY,
            inbox_domain=INBOX_DOMAIN,
        )
    assert excinfo.value.status == 200
    assert excinfo.value.body == rejection["errors"]


async def test_consent_url_uses_double_slash(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression guard: the Home SDK builds the URL with `//` and the host
    returns 404 if it's normalised."""
    seen_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        if request.method == "GET":
            return _consent_response()
        return _success_response()

    _patch_transport(monkeypatch, handler)

    await submit_sales_material_lead(
        METADATA,
        listing_id=LISTING_ID,
        identity=IDENTITY,
        inbox_domain=INBOX_DOMAIN,
    )

    assert seen_urls[0] == CONSENT_URL
    assert seen_urls[1] == LEAD_URL
    assert "//homedk/" in seen_urls[0]
    assert "//homedk/" in seen_urls[1]
