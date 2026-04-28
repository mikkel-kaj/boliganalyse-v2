import logging
import re
from typing import Any

import httpx

from src.config import get_settings
from src.providers.base import BaseProvider
from src.types.models import HTMLParseResult

logger = logging.getLogger(__name__)

FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape"
_MARKDOWN_IMG = re.compile(r"!\[.*?\]\((https?://[^)]+)\)")


class FirecrawlProvider(BaseProvider):
    """Universal fallback that delegates scraping to Firecrawl.

    `parse_html` ignores the html_content arg — Firecrawl re-fetches the
    URL itself and returns markdown + metadata. This intentionally
    mirrors the TypeScript behaviour: the upstream HTML we fetched is
    only used by other providers' canHandle checks, not by Firecrawl.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.firecrawl_api_key
        if not self._api_key:
            logger.warning(
                "Firecrawl API key not configured; provider will be disabled"
            )

    @property
    def name(self) -> str:
        return "Firecrawl"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return bool(self._api_key)

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        try:
            logger.info("[%s] Scraping URL: %s", self.name, url)

            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
                response = await client.post(
                    FIRECRAWL_SCRAPE_URL,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"url": url, "formats": ["markdown"]},
                )
                response.raise_for_status()
                payload: dict[str, Any] = response.json()

            data = payload.get("data") or {}
            extracted_text = data.get("markdown") or ""
            metadata = data.get("metadata") or {}

            image_url = self._extract_image_from_metadata(metadata, extracted_text)
            logger.info("[%s] Extracted image URL: %s", self.name, image_url or "none")

            return HTMLParseResult(
                extracted_text=extracted_text,
                property_image_url=image_url,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("[%s] Error scraping URL: %s", self.name, url)
            return HTMLParseResult(
                extracted_text=f"Failed to scrape content from {url}: {exc}",
            )

    @staticmethod
    def _extract_image_from_metadata(
        metadata: dict[str, Any], extracted_text: str
    ) -> str | None:
        if isinstance(metadata.get("ogImage"), str):
            return metadata["ogImage"]
        if isinstance(metadata.get("og:image"), str):
            return metadata["og:image"]

        twitter = metadata.get("twitter")
        if isinstance(twitter, dict) and isinstance(twitter.get("image"), str):
            return twitter["image"]

        if isinstance(metadata.get("twitter:image"), str):
            return metadata["twitter:image"]

        match = _MARKDOWN_IMG.search(extracted_text)
        if match:
            return match.group(1)

        return None
