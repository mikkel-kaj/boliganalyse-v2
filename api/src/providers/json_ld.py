import json
import logging
from typing import Any

from selectolax.parser import HTMLParser

from src.providers.base import BaseProvider
from src.types.models import HTMLParseResult
from src.utils.html import extract_first_image_url, extract_text_from_html

logger = logging.getLogger(__name__)


class JsonLdProvider(BaseProvider):
    """Generic provider that activates whenever the page exposes a
    `<script type="application/ld+json">` block. Useful for sites that
    publish structured data (estate.dk, edc.dk, nybolig.dk, …).
    """

    @property
    def name(self) -> str:
        return "JSON-LD Provider"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        if not html_content:
            return False
        try:
            tree = HTMLParser(html_content)
            return bool(tree.css('script[type="application/ld+json"]'))
        except Exception:
            logger.exception("[%s] Error checking JSON-LD presence", self.name)
            return False

    def extract_image_url(self, html_content: str) -> str | None:
        try:
            tree = HTMLParser(html_content)

            for node in tree.css('script[type="application/ld+json"]'):
                try:
                    data = json.loads(node.text() or "")
                except (ValueError, TypeError):
                    continue

                items: list[dict[str, Any]] = data if isinstance(data, list) else [data]
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    image = item.get("image")
                    if isinstance(image, str):
                        return image
                    if isinstance(image, list) and image and isinstance(image[0], str):
                        return image[0]

                    offers = item.get("offers")
                    if isinstance(offers, dict):
                        item_offered = offers.get("itemOffered")
                        if isinstance(item_offered, dict):
                            nested = item_offered.get("image")
                            if isinstance(nested, str):
                                return nested

            og = tree.css_first('meta[property="og:image"]')
            if og is not None:
                content = og.attributes.get("content")
                if content:
                    return content

            return extract_first_image_url(html_content)
        except Exception:
            logger.exception("[%s] Failed to extract image URL", self.name)
            return None

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        try:
            specific = self._extract_json_ld(html_content)
            text_content = extract_text_from_html(html_content)
            extracted = json.dumps(specific) + "\n" + text_content

            return HTMLParseResult(
                extracted_text=extracted,
                property_image_url=self.extract_image_url(html_content),
                original_link=url,
            )
        except Exception:
            logger.exception("[%s] Failed to parse HTML", self.name)
            return HTMLParseResult()

    def _extract_json_ld(self, html_content: str) -> dict[str, Any] | list[Any]:
        try:
            tree = HTMLParser(html_content)
            for node in tree.css('script[type="application/ld+json"]'):
                content = node.text() or ""
                if not content.strip():
                    continue
                try:
                    return json.loads(content)
                except (ValueError, TypeError):
                    logger.exception("[%s] Failed to parse JSON-LD block", self.name)
                    continue
            return {}
        except Exception:
            logger.exception("[%s] Failed to extract JSON-LD", self.name)
            return {}
