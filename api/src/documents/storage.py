"""Supabase Storage wrapper for the `documents` bucket.

The bucket holds PDFs we either scraped from a listing page or received
via email. It's private — we never serve files directly from Supabase;
the API proxies downloads under its own auth.
"""

from __future__ import annotations

import logging

from supabase import AsyncClient

logger = logging.getLogger(__name__)

_DEFAULT_BUCKET = "documents"


class DocumentStorage:
    """Thin async wrapper over `supabase.AsyncClient.storage`.

    The class accepts an already-constructed `AsyncClient` so tests can
    pass in a fake and routes can share the existing service-role client.
    """

    def __init__(self, client: AsyncClient, bucket: str = _DEFAULT_BUCKET) -> None:
        self._client = client
        self._bucket = bucket

    @property
    def bucket(self) -> str:
        return self._bucket

    def _file_api(self):
        return self._client.storage.from_(self._bucket)

    async def ensure_bucket(self) -> None:
        """Create the bucket as private if it doesn't exist. Idempotent."""
        try:
            await self._client.storage.get_bucket(self._bucket)
            return
        except Exception as exc:  # storage3 raises on 404
            logger.debug("get_bucket(%s) failed (%s); creating", self._bucket, exc)

        await self._client.storage.create_bucket(
            self._bucket,
            options={"public": False},
        )
        logger.info("Created private Storage bucket %r", self._bucket)

    async def upload(self, path: str, content: bytes, content_type: str) -> None:
        """Upload `content` to `path`, overwriting any existing object."""
        await self._file_api().upload(
            path,
            content,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },
        )

    async def download(self, path: str) -> bytes:
        return await self._file_api().download(path)

    async def exists(self, path: str) -> bool:
        return await self._file_api().exists(path)
