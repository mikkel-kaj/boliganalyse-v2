import logging
import re

from selectolax.parser import HTMLParser

logger = logging.getLogger(__name__)

_WHITESPACE_RUN = re.compile(r"\s+")
_NEWLINE_RUN = re.compile(r"\n+")
_IMG_TAG = re.compile(r'<img\s+[^>]*src="([^"]+)"[^>]*>', re.IGNORECASE)


def extract_text_from_html(html: str) -> str:
    """Strip scripts/styles/iframes and return cleaned-up body text."""
    if not html:
        return ""
    try:
        tree = HTMLParser(html)

        for tag in tree.css("script, style, noscript, iframe"):
            tag.decompose()

        body = tree.body
        if body is None:
            return ""

        text = body.text(separator=" ", strip=False) or ""
        text = _WHITESPACE_RUN.sub(" ", text)
        text = _NEWLINE_RUN.sub("\n", text)
        return text.strip()
    except Exception:
        logger.exception("Failed to extract text from HTML")
        return ""


def extract_first_image_url(html: str) -> str | None:
    """Best-effort first non-icon, non-logo property image."""
    if not html:
        return None
    try:
        for match in _IMG_TAG.finditer(html):
            src = match.group(1)
            if (
                "base64" not in src
                and ".svg" not in src
                and "icon" not in src
                and "logo" not in src
                and "http" in src
            ):
                return src
        return None
    except Exception:
        logger.exception("Failed to extract first image URL")
        return None
