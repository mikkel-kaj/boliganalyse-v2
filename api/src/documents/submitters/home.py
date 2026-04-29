"""Submit a sales-material lead to Home.dk so the broker emails the PDFs to us.

The Home web form on a listing page is a thin client over an internal lead API.
The flow is:

1. ``GET https://api.home.dk/leads//homedk/leads/SalesMaterial/consent`` returns
   the active consent record. We need ``current.id`` (referenced as
   ``currentConsentId`` on the lead) and ``current.purposeText`` (the long-form
   policy text the user is consenting to).
2. ``POST https://api.home.dk/leads//homedk/leads/sales-material`` with the
   listing's broker store id + case number, our identity, and the consent
   payload. A successful response is HTTP 200 with
   ``{"isSuccess": true, "isOperationCompleted": true, "errors": []}``.

The double slash after ``/leads/`` is intentional — it's how Home's own SDK
builds the URL, and the host without it returns 404. The reCAPTCHA on the
HTML form is client-side only; no token is required in the request body.
"""

from __future__ import annotations

from typing import Any

import httpx

from src.types.models import HomeLeadIdentity, HomeListingMetadata

_CONSENT_URL = "https://api.home.dk/leads//homedk/leads/SalesMaterial/consent"
_LEAD_URL = "https://api.home.dk/leads//homedk/leads/sales-material"

_BASE_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "X-Forwarded-Host": "home.dk",
    "Referer": "https://home.dk/",
    "Origin": "https://home.dk",
}


class HomeLeadSubmissionError(Exception):
    """Raised when the consent fetch or lead POST fails or is rejected."""

    def __init__(self, status: int, body: Any) -> None:
        super().__init__(f"[{status}] {body!r}")
        self.status = status
        self.body = body


async def submit_sales_material_lead(
    metadata: HomeListingMetadata,
    *,
    listing_id: str,
    identity: HomeLeadIdentity,
    inbox_domain: str,
    timeout: float = 30.0,
) -> None:
    """Submit a Home sales-material lead for ``metadata``.

    The reply email lands at ``<listing_id>@<inbox_domain>``, which is how
    the inbound email parser later correlates the broker's response back to
    the originating listing.
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        consent = await _fetch_consent(client)
        body = _build_lead_body(
            metadata=metadata,
            listing_id=listing_id,
            identity=identity,
            inbox_domain=inbox_domain,
            consent_id=consent["id"],
            consent_purpose_text=consent["purposeText"],
        )
        await _post_lead(client, body)


async def _fetch_consent(client: httpx.AsyncClient) -> dict[str, Any]:
    response = await client.get(_CONSENT_URL, headers=_BASE_HEADERS)
    if response.status_code // 100 != 2:
        raise HomeLeadSubmissionError(response.status_code, _safe_body(response))

    payload = response.json()
    current = payload.get("current") if isinstance(payload, dict) else None
    if not isinstance(current, dict) or "id" not in current or "purposeText" not in current:
        raise HomeLeadSubmissionError(
            response.status_code,
            f"unexpected consent response shape: {payload!r}",
        )
    return current


def _build_lead_body(
    *,
    metadata: HomeListingMetadata,
    listing_id: str,
    identity: HomeLeadIdentity,
    inbox_domain: str,
    consent_id: str,
    consent_purpose_text: str,
) -> dict[str, Any]:
    return {
        "currentConsentId": consent_id,
        "storeId": metadata.store_id,
        "caseNumber": metadata.case_number,
        "firstName": identity.first_name,
        "lastName": identity.last_name,
        "phoneNumber": identity.phone,
        "email": f"{listing_id}@{inbox_domain}",
        "postalCode": identity.postal_code,
        "comment": "",
        "hasAcceptedContactFromStore": False,
        "hasAcceptedMarketing": False,
        "hasAcceptedRelatedInformation": False,
        "consents": [
            {
                "type": "PurposeText",
                "privacyPolicy": identity.privacy_policy_html,
                "purposeText": identity.purpose_text_headline_html + consent_purpose_text,
            }
        ],
        "datasource": None,
        "projectId": None,
    }


async def _post_lead(client: httpx.AsyncClient, body: dict[str, Any]) -> None:
    headers = {**_BASE_HEADERS, "Content-Type": "application/json"}
    response = await client.post(_LEAD_URL, json=body, headers=headers)
    if response.status_code // 100 != 2:
        raise HomeLeadSubmissionError(response.status_code, _safe_body(response))

    payload = _safe_body(response)
    if not isinstance(payload, dict) or not payload.get("isSuccess"):
        errors = payload.get("errors") if isinstance(payload, dict) else payload
        raise HomeLeadSubmissionError(response.status_code, errors)


def _safe_body(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return response.text
