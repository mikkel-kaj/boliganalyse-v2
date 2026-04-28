import logging

from selectolax.parser import HTMLParser

from src.providers.base import BaseProvider
from src.types.models import HTMLParseResult
from src.utils.html import extract_first_image_url, extract_text_from_html
from src.utils.url import extract_domain

logger = logging.getLogger(__name__)


class HomeProvider(BaseProvider):
    """home.dk — direct realtor pages, so the URL itself is the original source."""

    @property
    def name(self) -> str:
        return "Home.dk"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        try:
            return extract_domain(url) == "home.dk"
        except Exception:
            return False

    def extract_image_url(self, html_content: str) -> str | None:
        try:
            tree = HTMLParser(html_content)

            og = tree.css_first('meta[property="og:image"]')
            if og is not None:
                content = og.attributes.get("content")
                if content:
                    return content

            for selector in (
                ".property-details-main__header img",
                ".image-gallery-preview img",
            ):
                node = tree.css_first(selector)
                if node is not None:
                    src = node.attributes.get("src")
                    if src:
                        return src

            return extract_first_image_url(html_content)
        except Exception:
            logger.exception("[%s] Failed to extract image URL", self.name)
            return None

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        try:
            return HTMLParseResult(
                extracted_text=extract_text_from_html(html_content),
                property_image_url=self.extract_image_url(html_content),
                original_link=url,
            )
        except Exception:
            logger.exception("[%s] Failed to parse HTML", self.name)
            return HTMLParseResult()
