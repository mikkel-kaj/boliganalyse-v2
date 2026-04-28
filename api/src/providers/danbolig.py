import logging

from src.providers.firecrawl import FirecrawlProvider
from src.types.models import HTMLParseResult
from src.utils.url import extract_domain

logger = logging.getLogger(__name__)

_COOKIE_BANNER_END = "Kun nødvendige formålOK til valgteTilpas"
_CONTACT_SECTION = "## Kontakt os"


class DanboligProvider(FirecrawlProvider):
    """danbolig.dk via Firecrawl, with site-specific markdown trimming."""

    @property
    def name(self) -> str:
        return "Danbolig"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        try:
            return extract_domain(url) == "danbolig.dk"
        except Exception:
            return False

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        result = await super().parse_html(url, html_content)

        if result.extracted_text:
            result.extracted_text = self._clean_markdown(result.extracted_text)
        else:
            logger.warning("[%s] No extracted text to process", self.name)

        return result

    @staticmethod
    def _clean_markdown(markdown: str) -> str:
        start_index = markdown.rfind(_COOKIE_BANNER_END)
        effective_start = (
            start_index + len(_COOKIE_BANNER_END) if start_index != -1 else 0
        )

        end_index = markdown.rfind(_CONTACT_SECTION)
        effective_end = end_index if end_index != -1 else len(markdown)

        return markdown[effective_start:effective_end].strip()
