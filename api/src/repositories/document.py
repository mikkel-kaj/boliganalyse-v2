"""Service-role data access for `app.listing_documents`."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from supabase import AsyncClient, acreate_client

from src.config import get_settings
from src.types.models import ListingDocumentRow, NewListingDocument

logger = logging.getLogger(__name__)


_COLUMNS = (
    "id, listing_id, kind, source, filename, content_type, size_bytes, "
    "sha256, storage_bucket, storage_path, source_url, source_email_id, "
    "created_at"
)


def _row_to_model(row: dict[str, Any]) -> ListingDocumentRow:
    return ListingDocumentRow(
        id=row["id"],
        listing_id=row["listing_id"],
        kind=row.get("kind"),
        source=row["source"],
        filename=row["filename"],
        content_type=row["content_type"],
        size_bytes=int(row["size_bytes"]),
        sha256=row["sha256"],
        storage_bucket=row["storage_bucket"],
        storage_path=row["storage_path"],
        source_url=row.get("source_url"),
        source_email_id=row.get("source_email_id"),
        created_at=row["created_at"],
    )


class DocumentRepository:
    """Service-role DAO for `app.listing_documents`."""

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    @classmethod
    async def create(cls) -> DocumentRepository:
        settings = get_settings()
        client = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
        return cls(client)

    def _table(self) -> Any:
        return self._client.schema("app").table("listing_documents")

    async def list_for_listing(self, listing_id: str) -> list[ListingDocumentRow]:
        response = (
            await self._table()
            .select(_COLUMNS)
            .eq("listing_id", listing_id)
            .order("created_at", desc=False)
            .execute()
        )
        return [_row_to_model(row) for row in (response.data or [])]

    async def get(self, doc_id: str) -> ListingDocumentRow | None:
        response = (
            await self._table()
            .select(_COLUMNS)
            .eq("id", doc_id)
            .maybe_single()
            .execute()
        )
        if response is None or response.data is None:
            return None
        return _row_to_model(response.data)

    async def find_by_listing_and_sha(
        self, listing_id: str, sha256: str
    ) -> ListingDocumentRow | None:
        response = (
            await self._table()
            .select(_COLUMNS)
            .eq("listing_id", listing_id)
            .eq("sha256", sha256)
            .maybe_single()
            .execute()
        )
        if response is None or response.data is None:
            return None
        return _row_to_model(response.data)

    async def insert(self, row: NewListingDocument) -> ListingDocumentRow:
        payload = {k: v for k, v in asdict(row).items() if v is not None}
        response = await self._table().insert(payload).execute()
        if not response.data:
            raise RuntimeError(
                f"Failed to insert listing_document for listing {row.listing_id}"
            )
        return _row_to_model(response.data[0])
