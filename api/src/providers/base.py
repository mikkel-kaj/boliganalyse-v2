import logging
from abc import ABC, abstractmethod

from src.types.models import HTMLParseResult
from src.utils.html import extract_first_image_url

logger = logging.getLogger(__name__)


class BaseProvider(ABC):
    """Abstract base for all listing providers.

    A provider knows (1) whether it can handle a given URL/HTML pair and
    (2) how to extract a text + image + optional original-source-link from
    the HTML.
    """

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def can_handle(self, url: str, html_content: str | None = None) -> bool: ...

    @abstractmethod
    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult: ...

    def extract_image_url(self, html_content: str) -> str | None:
        try:
            return extract_first_image_url(html_content)
        except Exception:
            logger.exception("[%s] Failed to extract image URL", self.name)
            return None
