"""Pipeline that turns `DocumentRef`s into persisted `listing_documents`.

Per ref:
1. Fetch the file via the Mindworking helper.
2. SHA-256 dedupe against existing rows for this listing.
3. Upload to Storage at `{listing_id}/{sha256}.pdf` if new.
4. Insert a row with `source='scrape'`.

Errors on a single document are logged and swallowed — the loop keeps
processing the rest.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Protocol

from src.types.models import DocumentRef, ListingDocumentRow, NewListingDocument

logger = logging.getLogger(__name__)


class _MindworkingFetcher(Protocol):
    fetch_document: Callable[..., Awaitable[object]]


class _Storage(Protocol):
    async def upload(self, path: str, content: bytes, content_type: str) -> None: ...

    @property
    def bucket(self) -> str: ...


class _Repo(Protocol):
    async def find_by_listing_and_sha(
        self, listing_id: str, sha256: str
    ) -> ListingDocumentRow | None: ...

    async def insert(self, row: NewListingDocument) -> ListingDocumentRow: ...


async def ingest_documents(
    listing_id: str,
    refs: list[DocumentRef],
    *,
    mindworking: _MindworkingFetcher,
    storage: _Storage,
    repo: _Repo,
) -> list[ListingDocumentRow]:
    """Fetch, dedupe, store, and persist each `DocumentRef`. Returns the
    rows that were either newly inserted or already existed.

    Per-document errors are logged and skipped; the function never
    raises on a fetch/upload/insert failure for a single document.
    """
    rows: list[ListingDocumentRow] = []
    for ref in refs:
        try:
            fetched = await mindworking.fetch_document(ref.url)
        except Exception as exc:
            logger.warning(
                "ingest_documents: fetch failed for %s (listing=%s): %s",
                ref.url,
                listing_id,
                exc,
            )
            continue

        try:
            existing = await repo.find_by_listing_and_sha(listing_id, fetched.sha256)
            if existing is not None:
                logger.info(
                    "ingest_documents: dedupe hit (listing=%s sha=%s) — skipping",
                    listing_id,
                    fetched.sha256,
                )
                rows.append(existing)
                continue

            storage_path = f"{listing_id}/{fetched.sha256}.pdf"
            await storage.upload(storage_path, fetched.content, fetched.content_type)

            inserted = await repo.insert(
                NewListingDocument(
                    listing_id=listing_id,
                    source="scrape",
                    filename=fetched.filename,
                    content_type=fetched.content_type,
                    size_bytes=len(fetched.content),
                    sha256=fetched.sha256,
                    storage_path=storage_path,
                    storage_bucket=storage.bucket,
                    kind=ref.kind or None,
                    source_url=ref.source_url,
                )
            )
            rows.append(inserted)
        except Exception as exc:
            logger.warning(
                "ingest_documents: persist failed for %s (listing=%s): %s",
                ref.url,
                listing_id,
                exc,
            )
            continue

    return rows
