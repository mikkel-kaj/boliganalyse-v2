"""Public-document downloader for `*.mindworking.eu`.

Mindworking is the broker SaaS that hosts Danbolig's listings (and many
others). Public document URLs look like:

    https://danbolig.mindworking.eu/api/Public/Documents/<guid>

The endpoint streams a PDF with a `Content-Disposition` header carrying
the original filename in RFC 5987 utf-8'' form.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

import httpx

_MAX_BYTES = 30 * 1024 * 1024  # 30 MB
_HOST_SUFFIX = ".mindworking.eu"


@dataclass(slots=True)
class FetchedDocument:
    content: bytes
    filename: str
    content_type: str
    sha256: str


class MindworkingFetchError(Exception):
    """Raised for non-200 responses, oversized payloads, or unexpected
    content-types from a `*.mindworking.eu` document URL."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(f"[{status}] {message}")
        self.status = status
        self.message = message


def _validate_host(url: str) -> str:
    """Return the host if it ends with `.mindworking.eu`. Raises ValueError
    otherwise — guards against arbitrary fetch via a user-controlled URL."""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if not host.endswith(_HOST_SUFFIX):
        raise ValueError(
            f"refusing to fetch non-mindworking host: {host!r} (url={url!r})"
        )
    return host


_RFC5987_RE = re.compile(
    r"filename\*\s*=\s*(?P<charset>[^']*)'(?P<lang>[^']*)'(?P<value>[^;]+)",
    re.IGNORECASE,
)
_PLAIN_RE = re.compile(
    r"filename\s*=\s*(?:\"(?P<quoted>[^\"]+)\"|(?P<bare>[^;]+))",
    re.IGNORECASE,
)


def _parse_filename(content_disposition: str | None, fallback_url: str) -> str:
    if content_disposition:
        rfc = _RFC5987_RE.search(content_disposition)
        if rfc:
            charset = (rfc.group("charset") or "utf-8").strip() or "utf-8"
            value = unquote(rfc.group("value").strip(), encoding=charset)
            if value:
                return value
        plain = _PLAIN_RE.search(content_disposition)
        if plain:
            value = (plain.group("quoted") or plain.group("bare") or "").strip()
            if value:
                return value
    # Fallback: last path segment, minus query/fragment.
    path = urlsplit(fallback_url).path or ""
    tail = path.rsplit("/", 1)[-1] or "document"
    return tail


async def fetch_document(url: str, *, timeout: float = 30.0) -> FetchedDocument:
    """Download a public Mindworking document.

    Validates the host first, GETs with redirect-following, caps the
    payload at ~30 MB, and returns a hashed `FetchedDocument`.
    """
    _validate_host(url)

    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
        response = await client.get(url)

    if response.status_code != 200:
        raise MindworkingFetchError(
            response.status_code,
            f"GET {url} returned status {response.status_code}",
        )

    content = response.content
    if len(content) > _MAX_BYTES:
        raise MindworkingFetchError(
            response.status_code,
            f"document at {url} exceeds {_MAX_BYTES}-byte cap (got {len(content)})",
        )

    content_type = response.headers.get("content-type", "application/octet-stream")
    primary_type = content_type.split(";", 1)[0].strip().lower()
    if not (primary_type == "application/pdf" or primary_type.startswith("application/")):
        raise MindworkingFetchError(
            response.status_code,
            f"unexpected content-type {content_type!r} for {url}",
        )

    filename = _parse_filename(response.headers.get("content-disposition"), url)
    sha256 = hashlib.sha256(content).hexdigest()

    return FetchedDocument(
        content=content,
        filename=filename,
        content_type=content_type,
        sha256=sha256,
    )
