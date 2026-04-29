from typing import Any

from pydantic import BaseModel, Field, HttpUrl

from src.types.models import ListingDocumentRow


class StartAnalysisRequest(BaseModel):
    url: str
    force: bool = Field(default=False, description="Re-run even if a row already exists")


class ListingResponse(BaseModel):
    """Public projection of `app.apartment_listings`. Internal fields
    (raw HTML, extracted text, error_message, normalized_url, etc.) are
    intentionally omitted — they never leave the server."""

    id: str
    url: str
    status: str
    realtor: str | None = None
    property_image_url: str | None = None
    analysis: dict[str, Any] | None = None
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "ListingResponse":
        return cls(
            id=row["id"],
            url=row["url"],
            status=row["status"],
            realtor=row.get("realtor"),
            property_image_url=row.get("property_image_url"),
            analysis=row.get("analysis"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class StartAnalysisResponse(BaseModel):
    listing: ListingResponse
    is_existing: bool


class FeedbackRequest(BaseModel):
    feedback_type: str
    message: str
    email: str | None = None
    listing_id: str | None = None
    property_address: str | None = None


class FeedbackResponse(BaseModel):
    id: str
    created_at: str


class HealthResponse(BaseModel):
    status: str = "ok"


class ListingDocumentResponse(BaseModel):
    """Public projection of `app.listing_documents`. Storage location
    (bucket/path) and integrity hash stay server-side."""

    id: str
    kind: str | None = None
    filename: str
    content_type: str
    size_bytes: int
    source: str
    source_url: str | None = None
    created_at: str

    @classmethod
    def from_row(cls, row: ListingDocumentRow) -> "ListingDocumentResponse":
        return cls(
            id=row.id,
            kind=row.kind,
            filename=row.filename,
            content_type=row.content_type,
            size_bytes=row.size_bytes,
            source=row.source,
            source_url=row.source_url,
            created_at=row.created_at,
        )
