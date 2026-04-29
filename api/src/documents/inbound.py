"""Pure-function parser for raw RFC822 emails Postfix delivers.

Extracts the listing UUID from the To/Delivered-To/X-Original-To local
part, plus any Mindworking document URLs found in the text and HTML
parts. No I/O — the webhook route owns all side effects.
"""

from __future__ import annotations

import html
import logging
import re
import uuid
from dataclasses import dataclass, field
from email import message_from_bytes
from email.message import Message

logger = logging.getLogger(__name__)


_MINDWORKING_URL_RE = re.compile(
    r"https://[a-z0-9-]+\.mindworking\.eu/api/Public/Documents/[0-9a-f-]+",
    re.IGNORECASE,
)
_ADDRESS_RE = re.compile(r"([A-Za-z0-9_.+\-]+)@([A-Za-z0-9.\-]+)")


@dataclass(slots=True)
class ParsedInboundEmail:
    listing_id: str | None
    inbox_local_part: str
    from_address: str | None
    subject: str | None
    document_urls: list[str] = field(default_factory=list)


def parse_inbound_email(raw_rfc822: bytes) -> ParsedInboundEmail:
    msg = message_from_bytes(raw_rfc822)

    subject = msg.get("Subject")
    from_address = _extract_address(msg.get("From"))
    inbox_local_part, listing_id = _resolve_recipient(msg)
    document_urls = _extract_document_urls(msg)

    return ParsedInboundEmail(
        listing_id=listing_id,
        inbox_local_part=inbox_local_part,
        from_address=from_address,
        subject=subject,
        document_urls=document_urls,
    )


def _resolve_recipient(msg: Message) -> tuple[str, str | None]:
    """Walk Delivered-To, X-Original-To, then To — Postfix sets the first
    two and they survive forwarding better than the original To header."""
    for header in ("Delivered-To", "X-Original-To", "To"):
        value = msg.get(header)
        if not value:
            continue
        match = _ADDRESS_RE.search(value)
        if match is None:
            continue
        local_part = match.group(1)
        try:
            uuid.UUID(local_part)
            return local_part, local_part
        except ValueError:
            return local_part, None
    return "", None


def _extract_address(raw: str | None) -> str | None:
    if not raw:
        return None
    match = _ADDRESS_RE.search(raw)
    if match is None:
        return None
    return match.group(0)


def _extract_document_urls(msg: Message) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    for part in _iter_text_parts(msg):
        decoded = html.unescape(part)
        for match in _MINDWORKING_URL_RE.finditer(decoded):
            url = match.group(0)
            if url in seen:
                continue
            seen.add(url)
            ordered.append(url)

    return ordered


def _iter_text_parts(msg: Message) -> list[str]:
    parts: list[str] = []
    if msg.is_multipart():
        for sub in msg.walk():
            if sub.is_multipart():
                continue
            content_type = sub.get_content_type()
            if content_type not in ("text/plain", "text/html"):
                continue
            text = _decode_part(sub)
            if text:
                parts.append(text)
    else:
        text = _decode_part(msg)
        if text:
            parts.append(text)
    return parts


def _decode_part(part: Message) -> str | None:
    payload = part.get_payload(decode=True)
    if payload is None:
        return None
    if not isinstance(payload, bytes):
        return str(payload)
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except (LookupError, UnicodeDecodeError):
        return payload.decode("utf-8", errors="replace")
