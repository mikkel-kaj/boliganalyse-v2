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


@dataclass(slots=True)
class ListingDocumentRow:
    """Mirrors a row in `app.listing_documents`."""

    id: str
    listing_id: str
    source: str
    filename: str
    content_type: str
    size_bytes: int
    sha256: str
    storage_bucket: str
    storage_path: str
    created_at: str
    kind: str | None = None
    source_url: str | None = None
    source_email_id: str | None = None


@dataclass(slots=True)
class NewListingDocument:
    """Payload for inserting a new row into `app.listing_documents`."""

    listing_id: str
    source: str
    filename: str
    content_type: str
    size_bytes: int
    sha256: str
    storage_path: str
    kind: str | None = None
    storage_bucket: str = "documents"
    source_url: str | None = None
    source_email_id: str | None = None


@dataclass(slots=True)
class DocumentRef:
    """Reference to a document discovered on a listing page, before fetch."""

    url: str
    filename_hint: str
    kind: str
    source_url: str


@dataclass(slots=True)
class InboundEmailRow:
    """Mirrors a row in `app.inbound_emails`."""

    id: str
    inbox_local_part: str
    status: str
    received_at: str
    listing_id: str | None = None
    from_address: str | None = None
    subject: str | None = None
    raw_storage_path: str | None = None
    error_message: str | None = None


@dataclass(slots=True)
class HomeListingMetadata:
    store_id: str
    case_number: str


@dataclass(slots=True)
class HomeLeadIdentity:
    first_name: str
    last_name: str
    phone: str           # E.164, e.g. "+4512345678"
    postal_code: str     # e.g. "2100"
    privacy_policy_html: str
    purpose_text_headline_html: str
