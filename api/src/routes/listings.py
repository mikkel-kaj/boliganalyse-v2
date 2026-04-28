import asyncio
import json
import logging
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse
from starlette.requests import Request

from src.repositories.listing import ListingRepository
from src.routes.dependencies import get_repository
from src.routes.schemas import (
    ListingResponse,
    StartAnalysisRequest,
    StartAnalysisResponse,
)
from src.services.listing_processor import ListingProcessorService
from src.types.status import TERMINAL_STATUSES, AnalysisStatus, status_from_string
from src.utils.url import normalize_url
from src.utils.validation import validate_listing_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/listings", tags=["listings"])

_SSE_POLL_INTERVAL_SECONDS = 0.5
_SSE_MAX_DURATION_SECONDS = 600


@router.post("", response_model=StartAnalysisResponse)
async def start_analysis(
    payload: StartAnalysisRequest,
    repository: Annotated[ListingRepository, Depends(get_repository)],
) -> StartAnalysisResponse:
    validation = validate_listing_url(payload.url)
    if not validation.valid:
        raise HTTPException(status_code=400, detail=validation.error)

    normalized = normalize_url(payload.url)
    existing = await repository.find_by_normalized_url(normalized)

    if existing:
        existing_status = status_from_string(existing.get("status"))
        is_errored = existing_status == AnalysisStatus.ERROR
        if not (is_errored or payload.force):
            return StartAnalysisResponse(
                listing=ListingResponse.from_row(existing),
                is_existing=True,
            )
        await repository.update_status(existing["id"], AnalysisStatus.QUEUED)
        listing = await repository.get_by_id(existing["id"]) or existing
    else:
        listing = await repository.create_listing(payload.url, normalized)
        logger.info("Created new listing %s", listing["id"])

    asyncio.create_task(_run_processor(listing["id"], listing["url"], repository))

    return StartAnalysisResponse(
        listing=ListingResponse.from_row(listing),
        is_existing=False,
    )


@router.get("", response_model=list[ListingResponse])
async def list_recent(
    repository: Annotated[ListingRepository, Depends(get_repository)],
    limit: int = 20,
) -> list[ListingResponse]:
    rows = await repository.list_recent(limit=min(limit, 100))
    return [ListingResponse.from_row(row) for row in rows]


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: str,
    repository: Annotated[ListingRepository, Depends(get_repository)],
) -> ListingResponse:
    row = await repository.get_by_id(listing_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return ListingResponse.from_row(row)


@router.get("/{listing_id}/events")
async def stream_listing_events(
    listing_id: str,
    request: Request,
    repository: Annotated[ListingRepository, Depends(get_repository)],
) -> EventSourceResponse:
    """Server-Sent Events stream of the listing's status until it
    reaches a terminal state. The stream emits one `status` event per
    DB-observed change, plus a final `complete` or `error` event."""

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        last_status: str | None = None
        last_updated_at: str | None = None
        elapsed = 0.0

        while elapsed < _SSE_MAX_DURATION_SECONDS:
            if await request.is_disconnected():
                logger.info("SSE client disconnected for listing %s", listing_id)
                return

            row = await repository.get_by_id(listing_id)
            if row is None:
                yield {"event": "error", "data": json.dumps({"error": "not_found"})}
                return

            current_status = row["status"]
            current_updated_at = row["updated_at"]

            if (current_status, current_updated_at) != (last_status, last_updated_at):
                last_status = current_status
                last_updated_at = current_updated_at
                yield {
                    "event": "status",
                    "data": ListingResponse.from_row(row).model_dump_json(),
                }

                terminal = status_from_string(current_status) in TERMINAL_STATUSES
                if terminal:
                    final_event = (
                        "complete"
                        if status_from_string(current_status) == AnalysisStatus.COMPLETED
                        else "error"
                    )
                    yield {
                        "event": final_event,
                        "data": ListingResponse.from_row(row).model_dump_json(),
                    }
                    return

            await asyncio.sleep(_SSE_POLL_INTERVAL_SECONDS)
            elapsed += _SSE_POLL_INTERVAL_SECONDS

        yield {"event": "timeout", "data": json.dumps({"error": "stream_timeout"})}

    return EventSourceResponse(event_generator())


async def _run_processor(
    listing_id: str, url: str, repository: ListingRepository
) -> None:
    """Background task wrapper. Errors are caught + persisted in the
    processor itself; this wrapper just exists so a stray exception
    can't crash the asyncio task without being logged."""
    try:
        processor = ListingProcessorService(repository)
        await processor.process_listing(listing_id, url)
    except Exception:
        logger.exception("Processor crashed for listing %s", listing_id)
