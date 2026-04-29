import logging
from datetime import datetime, timezone
from typing import Any

from supabase import AsyncClient, acreate_client

from src.config import get_settings
from src.types.status import AnalysisStatus

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_text(text: str | None) -> str | None:
    """Strip null bytes — Postgres rejects them in `text` columns even
    though Python strings tolerate them."""
    if text is None:
        return None
    return text.replace(chr(0), "").strip()


class ListingRepository:
    """Service-role data access for `app.apartment_listings` and `app.feedback`.

    All methods write through PostgREST under the service-role JWT, so
    they bypass RLS. Anon callers cannot reach this repository — only
    the FastAPI server holds the service-role key.
    """

    _LISTING_COLUMNS = (
        "id, url, normalized_url, url_redirect, realtor, status, "
        "analysis, property_image_url, error_message, created_at, updated_at"
    )

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    @classmethod
    async def create(cls) -> "ListingRepository":
        settings = get_settings()
        client = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
        return cls(client)

    def _table(self) -> Any:
        return self._client.schema("app").table("apartment_listings")

    async def find_by_normalized_url(self, normalized_url: str) -> dict[str, Any] | None:
        response = (
            await self._table()
            .select(self._LISTING_COLUMNS)
            .eq("normalized_url", normalized_url)
            .maybe_single()
            .execute()
        )
        if response is None:
            return None
        return response.data

    async def get_by_id(self, listing_id: str) -> dict[str, Any] | None:
        response = (
            await self._table()
            .select(self._LISTING_COLUMNS)
            .eq("id", listing_id)
            .maybe_single()
            .execute()
        )
        if response is None:
            return None
        return response.data

    async def list_recent(self, *, limit: int = 20) -> list[dict[str, Any]]:
        response = (
            await self._table()
            .select(self._LISTING_COLUMNS)
            .eq("status", AnalysisStatus.COMPLETED.value)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []

    async def create_listing(self, url: str, normalized_url: str) -> dict[str, Any]:
        now = _now_iso()
        response = (
            await self._table()
            .insert(
                {
                    "url": url,
                    "normalized_url": normalized_url,
                    "status": AnalysisStatus.PENDING.value,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            .execute()
        )
        if not response.data:
            raise RuntimeError(f"Failed to create listing for URL: {url}")
        return response.data[0]

    async def update_status(
        self,
        listing_id: str,
        status: AnalysisStatus,
        error_message: str | None = None,
    ) -> None:
        logger.info("Updating status for listing %s to %s", listing_id, status.value)
        update: dict[str, Any] = {"status": status.value, "updated_at": _now_iso()}
        if error_message is not None:
            update["error_message"] = error_message
        await self._table().update(update).eq("id", listing_id).execute()

    async def set_error_status(
        self,
        listing_id: str,
        error: BaseException | str,
        status: AnalysisStatus = AnalysisStatus.ERROR,
    ) -> None:
        if isinstance(error, BaseException):
            message = f"{type(error).__name__}: {error}"
        else:
            message = str(error)
        await self.update_status(listing_id, status, error_message=message)

    async def set_email_lead_sent(self, listing_id: str) -> None:
        now = _now_iso()
        await self._table().update(
            {
                "email_lead_sent_at": now,
                "status": AnalysisStatus.AWAITING_DOCUMENTS.value,
                "updated_at": now,
            }
        ).eq("id", listing_id).execute()

    async def save_analysis_result(
        self,
        listing_id: str,
        analysis: dict[str, Any],
        status: AnalysisStatus = AnalysisStatus.COMPLETED,
    ) -> None:
        await self._table().update(
            {
                "analysis": analysis,
                "status": status.value,
                "updated_at": _now_iso(),
            }
        ).eq("id", listing_id).execute()

    async def update_listing_metadata(
        self,
        listing_id: str,
        *,
        text_primary: str | None = None,
        text_redirect: str | None = None,
        html_primary: str | None = None,
        html_redirect: str | None = None,
        url_redirect: str | None = None,
        property_image_url: str | None = None,
        realtor: str | None = None,
    ) -> None:
        update: dict[str, Any] = {"updated_at": _now_iso()}
        if text_primary is not None:
            update["text_primary"] = _sanitize_text(text_primary)
        if text_redirect is not None:
            update["text_redirect"] = _sanitize_text(text_redirect)
        if html_primary is not None:
            update["html_primary"] = _sanitize_text(html_primary)
        if html_redirect is not None:
            update["html_redirect"] = _sanitize_text(html_redirect)
        if url_redirect is not None:
            update["url_redirect"] = url_redirect
        if property_image_url is not None:
            update["property_image_url"] = property_image_url
        if realtor is not None:
            update["realtor"] = realtor

        if len(update) == 1:  # only updated_at — nothing to write
            return

        await self._table().update(update).eq("id", listing_id).execute()

    async def insert_feedback(
        self,
        *,
        feedback_type: str,
        message: str,
        email: str | None,
        listing_id: str | None,
        property_address: str | None,
    ) -> dict[str, Any]:
        response = (
            await self._client.schema("app")
            .table("feedback")
            .insert(
                {
                    "feedback_type": feedback_type,
                    "message": message,
                    "email": email,
                    "listing_id": listing_id,
                    "property_address": property_address,
                }
            )
            .execute()
        )
        if not response.data:
            raise RuntimeError("Failed to insert feedback")
        return response.data[0]
