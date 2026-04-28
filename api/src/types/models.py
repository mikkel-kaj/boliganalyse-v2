from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class HTMLParseResult:
    """Result of a provider parsing an HTML document."""

    extracted_text: str | None = None
    property_image_url: str | None = None
    original_link: str | None = None


@dataclass(slots=True)
class ValidationResult:
    valid: bool
    error: str | None = None


@dataclass(slots=True)
class ListingRow:
    """Mirrors a row in `app.apartment_listings`. Internal scrape fields
    (`html_*`, `text_*`, `error_message`) are loaded server-side but never
    serialized to API responses."""

    id: str
    url: str
    normalized_url: str
    status: str
    created_at: str
    updated_at: str
    url_redirect: str | None = None
    realtor: str | None = None
    html_primary: str | None = None
    html_redirect: str | None = None
    text_primary: str | None = None
    text_redirect: str | None = None
    error_message: str | None = None
    analysis: dict[str, Any] | None = None
    property_image_url: str | None = None
