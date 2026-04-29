"""Extract document references from a Danbolig listing HTML page.

Danbolig embeds listing data as Vue props using single-quoted JS object
literal syntax. The relevant block looks like::

    'documents': [
      { 'brokerId': '486', 'url': 'https://...', 'name': 'Salgsopstilling',
        'type': 'Salgsopstilling - Villa', ... },
      ...
    ],

We locate the `'documents'` key, walk the matching brackets to capture
the array literal, then convert the single-quoted JS to JSON and parse.
"""

from __future__ import annotations

import json
import logging
import re

from src.types.models import DocumentRef

logger = logging.getLogger(__name__)

_DOCUMENTS_KEY_RE = re.compile(r"['\"]documents['\"]\s*:\s*", re.IGNORECASE)


def _extract_array_literal(html: str, start: int) -> str | None:
    """Walk from `start` (a `[`), tracking string literals and depth, and
    return the slice up to and including the matching `]`. Returns None
    if the brackets don't balance."""
    if start >= len(html) or html[start] != "[":
        return None

    depth = 0
    i = start
    in_string: str | None = None  # holds the quote char when inside a string
    while i < len(html):
        ch = html[i]
        if in_string is not None:
            if ch == "\\" and i + 1 < len(html):
                i += 2
                continue
            if ch == in_string:
                in_string = None
            i += 1
            continue

        if ch in ("'", '"'):
            in_string = ch
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return html[start : i + 1]
        i += 1

    return None


_SINGLE_QUOTED_STRING_RE = re.compile(r"'((?:\\.|[^'\\])*)'", re.DOTALL)


def _single_to_double_quoted_json(literal: str) -> str:
    """Convert a JS-style single-quoted object/array literal into JSON.

    Replaces each `'...'` string literal with a JSON-safe `"..."` string
    by escaping any embedded double quotes and unescaping `\\'`.
    Also drops trailing commas before `]` or `}`.
    """

    def _replace(match: re.Match[str]) -> str:
        body = match.group(1)
        body = body.replace("\\'", "'")
        body = body.replace("\\", "\\\\").replace('"', '\\"')
        # Re-fix common escapes that we just double-escaped: not needed
        # because the original is JS source where backslashes are rare in
        # these property values. The naive escape above is safe for the
        # Danbolig-style payloads we see (URLs, plain Danish text).
        return f'"{body}"'

    converted = _SINGLE_QUOTED_STRING_RE.sub(_replace, literal)
    # Strip trailing commas: `[ {..}, ]` or `{ "x": 1, }` -> valid JSON.
    converted = re.sub(r",(\s*[}\]])", r"\1", converted)
    return converted


def extract_danbolig_documents(html: str) -> list[DocumentRef]:
    """Return one `DocumentRef` per entry in the embedded `documents` array.

    Robust to:
    - The block being absent (returns `[]`).
    - The value being `null` (returns `[]`).
    - Malformed JSON inside the block (returns `[]`, never raises).
    """
    if not html:
        return []

    match = _DOCUMENTS_KEY_RE.search(html)
    if match is None:
        return []

    cursor = match.end()
    # Skip whitespace after the colon.
    while cursor < len(html) and html[cursor].isspace():
        cursor += 1
    if cursor >= len(html):
        return []

    if html.startswith("null", cursor):
        return []
    if html[cursor] != "[":
        return []

    array_literal = _extract_array_literal(html, cursor)
    if array_literal is None:
        logger.debug("Danbolig: unterminated documents array literal")
        return []

    try:
        json_text = _single_to_double_quoted_json(array_literal)
        parsed = json.loads(json_text)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Danbolig: failed to parse documents block: %s", exc)
        return []

    if not isinstance(parsed, list):
        return []

    refs: list[DocumentRef] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        url = entry.get("url")
        if not isinstance(url, str) or not url:
            continue
        name = entry.get("name") or ""
        kind = entry.get("type") or ""
        refs.append(
            DocumentRef(
                url=url,
                filename_hint=str(name),
                kind=str(kind),
                source_url=url,
            )
        )
    return refs
