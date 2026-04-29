"""Webhook routes — currently just the inbound-email entry point.

Postfix's pipe transport delivers the raw RFC822 message as the request
body with `Content-Type: message/rfc822`. We persist a row first so the
email is always replayable, then resume the analysis pipeline if the
local part matched a listing.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from src.config import get_settings
from src.documents.inbound import ParsedInboundEmail, parse_inbound_email
from src.repositories.inbound_email import InboundEmailRepository
from src.repositories.listing import ListingRepository
from src.routes.dependencies import (
    get_inbound_email_repository,
    get_repository,
)
from src.services.listing_processor import ListingProcessorService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/inbound-email")
async def inbound_email(
    request: Request,
    listing_repo: Annotated[ListingRepository, Depends(get_repository)],
    email_repo: Annotated[
        InboundEmailRepository, Depends(get_inbound_email_repository)
    ],
    x_inbound_secret: Annotated[str | None, Header(alias="X-Inbound-Secret")] = None,
) -> dict[str, Any]:
    settings = get_settings()
    if (
        not settings.inbound_email_secret
        or not x_inbound_secret
        or x_inbound_secret != settings.inbound_email_secret
    ):
        raise HTTPException(status_code=401, detail="invalid inbound secret")

    raw_body = await request.body()

    try:
        parsed = parse_inbound_email(raw_body)
    except Exception as exc:
        logger.exception("Failed to parse inbound email")
        # Persist a stub row so the failure is observable.
        await email_repo.insert(
            inbox_local_part="",
            status="error",
            error_message=f"parse_failed: {exc}",
        )
        raise HTTPException(status_code=400, detail="failed to parse email") from exc

    inserted = await email_repo.insert(
        inbox_local_part=parsed.inbox_local_part,
        status="received",
        listing_id=parsed.listing_id,
        from_address=parsed.from_address,
        subject=parsed.subject,
    )

    if parsed.listing_id is None:
        await email_repo.update_status(inserted.id, "unmatched")
        return {
            "status": "ignored",
            "reason": "unmatched local part",
            "inbound_email_id": inserted.id,
        }

    await email_repo.update_status(inserted.id, "matched")

    if not parsed.document_urls:
        return {
            "status": "ignored",
            "reason": "no documents",
            "inbound_email_id": inserted.id,
        }

    try:
        await _resume_pipeline(listing_repo, parsed, inserted.id)
    except Exception as exc:
        logger.exception(
            "Pipeline resume failed for listing %s (email %s)",
            parsed.listing_id,
            inserted.id,
        )
        await email_repo.update_status(
            inserted.id, "error", error_message=f"resume_failed: {exc}"
        )
        raise HTTPException(status_code=500, detail="pipeline resume failed") from exc

    await email_repo.update_status(inserted.id, "parsed")
    return {"status": "ok", "inbound_email_id": inserted.id}


async def _resume_pipeline(
    listing_repo: ListingRepository,
    parsed: ParsedInboundEmail,
    inbound_email_id: str,
) -> None:
    assert parsed.listing_id is not None
    processor = ListingProcessorService(listing_repo)
    await processor.complete_with_documents(
        parsed.listing_id,
        parsed.document_urls,
        source_email_id=inbound_email_id,
    )
