import logging

from src.providers.base import BaseProvider
from src.types.models import HTMLParseResult
from src.utils.html import extract_text_from_html

logger = logging.getLogger(__name__)


class FallbackProvider(BaseProvider):
    """Last-resort provider that just dumps body text. Always claims to handle."""

    @property
    def name(self) -> str:
        return "FallbackProvider"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return True

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        try:
            return HTMLParseResult(
                extracted_text=extract_text_from_html(html_content),
            )
        except Exception:
            logger.exception("[%s] Failed to parse HTML", self.name)
            return HTMLParseResult()
