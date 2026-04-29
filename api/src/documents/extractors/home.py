"""Extract listing metadata (broker store id + case number) from a Home.dk page.

Home.dk is a Nuxt SSR app. The relevant payload sits inside a script tag::

    <script id="__NUXT_DATA__" type="application/json">[ ...flat array... ]</script>

The array uses shared-reference compression: most entries are integers that
point to other indices in the same array. We walk the array, find the one
dict that has both ``shopNumber`` and ``id`` at the top level (the case row),
and resolve those two values. Everything else stays untouched.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from src.types.models import HomeListingMetadata

logger = logging.getLogger(__name__)

_NUXT_DATA_RE = re.compile(
    r'<script[^>]*id="__NUXT_DATA__"[^>]*>([^<]+)</script>',
    re.IGNORECASE,
)


def _resolve(payload: list[Any], value: Any) -> Any:
    """If `value` is a non-bool int index into `payload`, return the target;
    otherwise return `value` unchanged. Bools are excluded because Python
    treats them as `int`."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and 0 <= value < len(payload):
        return payload[value]
    return value


def extract_home_listing_metadata(html: str) -> HomeListingMetadata | None:
    """Return the broker store id and listing case number, or None.

    Robust to:
    - Missing ``__NUXT_DATA__`` script tag.
    - Malformed JSON inside the tag.
    - Payload that contains no case row (no dict with both ``shopNumber`` and ``id``).
    - Any other parser failure.
    """
    if not html:
        return None

    match = _NUXT_DATA_RE.search(html)
    if match is None:
        logger.warning("Home: __NUXT_DATA__ script tag not found")
        return None

    try:
        payload = json.loads(match.group(1))
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Home: failed to parse __NUXT_DATA__ JSON: %s", exc)
        return None

    if not isinstance(payload, list):
        logger.warning("Home: __NUXT_DATA__ payload is not a list")
        return None

    try:
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            if "shopNumber" not in entry or "id" not in entry:
                continue
            shop_number = _resolve(payload, entry["shopNumber"])
            case_id = _resolve(payload, entry["id"])
            if shop_number is None or case_id is None:
                continue
            return HomeListingMetadata(
                store_id=str(shop_number),
                case_number=str(case_id),
            )
    except Exception as exc:
        logger.warning("Home: unexpected error while walking payload: %s", exc)
        return None

    logger.warning("Home: no case row (dict with shopNumber+id) found in payload")
    return None
