"""Service-role data access for `app.inbound_emails`."""

from __future__ import annotations

import logging
from typing import Any

from supabase import AsyncClient, acreate_client

from src.config import get_settings
from src.types.models import InboundEmailRow

logger = logging.getLogger(__name__)


_COLUMNS = (
    "id, inbox_local_part, listing_id, from_address, subject, "
    "raw_storage_path, status, error_message, received_at"
)


def _row_to_model(row: dict[str, Any]) -> InboundEmailRow:
    return InboundEmailRow(
        id=row["id"],
        inbox_local_part=row["inbox_local_part"],
        listing_id=row.get("listing_id"),
        from_address=row.get("from_address"),
        subject=row.get("subject"),
        raw_storage_path=row.get("raw_storage_path"),
        status=row["status"],
        error_message=row.get("error_message"),
        received_at=row["received_at"],
    )


class InboundEmailRepository:
    """Service-role DAO for `app.inbound_emails`."""

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    @classmethod
    async def create(cls) -> InboundEmailRepository:
        settings = get_settings()
        client = await acreate_client(
            settings.supabase_url, settings.supabase_service_role_key
        )
        return cls(client)

    def _table(self) -> Any:
        return self._client.schema("app").table("inbound_emails")

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
        payload: dict[str, Any] = {
            "inbox_local_part": inbox_local_part,
            "status": status,
        }
        if listing_id is not None:
            payload["listing_id"] = listing_id
        if from_address is not None:
            payload["from_address"] = from_address
        if subject is not None:
            payload["subject"] = subject
        if raw_storage_path is not None:
            payload["raw_storage_path"] = raw_storage_path
        if error_message is not None:
            payload["error_message"] = error_message

        response = await self._table().insert(payload).execute()
        if not response.data:
            raise RuntimeError(
                f"Failed to insert inbound_email for {inbox_local_part}"
            )
        return _row_to_model(response.data[0])

    async def update_status(
        self,
        email_id: str,
        status: str,
        error_message: str | None = None,
    ) -> None:
        update: dict[str, Any] = {"status": status}
        if error_message is not None:
            update["error_message"] = error_message
        await self._table().update(update).eq("id", email_id).execute()
