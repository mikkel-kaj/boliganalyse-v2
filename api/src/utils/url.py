import logging
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


def normalize_url(url: str) -> str:
    """Strip query params + fragment so duplicate listings collapse to one row."""
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return url
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    except Exception:
        logger.exception("Error normalizing URL: %s", url)
        return url


def extract_domain(url: str) -> str:
    try:
        host = urlparse(url).hostname or ""
        return host.removeprefix("www.")
    except Exception:
        logger.exception("Error extracting domain: %s", url)
        return ""


def is_absolute_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return bool(parsed.scheme and parsed.netloc)
    except Exception:
        return False


def resolve_url(base_url: str, relative_url: str) -> str:
    try:
        return urljoin(base_url, relative_url)
    except Exception:
        logger.exception("Error resolving URL")
        return ""
