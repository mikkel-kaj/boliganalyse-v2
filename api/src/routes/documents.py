"""Document listing + proxied download endpoints.

Downloads stream PDF bytes through the API rather than redirecting to
Supabase Storage's public URL, so the bucket can stay private and the
hostname stays `api.dev.boliganalyse.ai`.
"""

from __future__ import annotations

import logging
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from src.documents.storage import DocumentStorage
from src.repositories.document import DocumentRepository
from src.repositories.listing import ListingRepository
from src.routes.dependencies import (
    get_document_repository,
    get_document_storage,
    get_repository,
)
from src.routes.schemas import ListingDocumentResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/listings", tags=["documents"])


def _content_disposition(filename: str) -> str:
    """RFC 5987-encoded Content-Disposition for non-ASCII filenames.

    Always emits both an ASCII fallback and the encoded `filename*` form,
    matching what browsers expect for Danish characters like æøå."""
    ascii_fallback = filename.encode("ascii", "replace").decode("ascii").replace('"', "")
    encoded = quote(filename, safe="")
    return f"inline; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


@router.get(
    "/{listing_id}/documents",
    response_model=list[ListingDocumentResponse],
)
async def list_documents(
    listing_id: str,
    listings: Annotated[ListingRepository, Depends(get_repository)],
    documents: Annotated[DocumentRepository, Depends(get_document_repository)],
) -> list[ListingDocumentResponse]:
    listing = await listings.get_by_id(listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")

    rows = await documents.list_for_listing(listing_id)
    return [ListingDocumentResponse.from_row(row) for row in rows]


@router.get("/{listing_id}/documents/{document_id}")
async def download_document(
    listing_id: str,
    document_id: str,
    listings: Annotated[ListingRepository, Depends(get_repository)],
    documents: Annotated[DocumentRepository, Depends(get_document_repository)],
    storage: Annotated[DocumentStorage, Depends(get_document_storage)],
) -> Response:
    listing = await listings.get_by_id(listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")

    row = await documents.get(document_id)
    if row is None or row.listing_id != listing_id:
        raise HTTPException(status_code=404, detail="Document not found")

    payload = await storage.download(row.storage_path)

    return Response(
        content=payload,
        media_type=row.content_type,
        headers={
            "Content-Disposition": _content_disposition(row.filename),
            "Cache-Control": "private, max-age=3600",
        },
    )
