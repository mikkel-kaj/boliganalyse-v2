import logging
import re

import httpx

from src.providers.base import BaseProvider
from src.types.models import HTMLParseResult
from src.utils.html import extract_text_from_html
from src.utils.url import extract_domain

logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
)
_UDBUD_PARAM = re.compile(r"[?&]udbud=([^&]+)")
_RADON_NOISE = re.compile(
    r"RadonrisikoRadonrisikoen vurderes til at være ukendtUkendt"
)
_NETBOLIG_NOISE = re.compile(
    r"Se hvilke internetforbindelser, der er tilgængelige på adressen\. "
    r"Bemærk, at mobildækning ikke er oplyst\."
)


class BoligsidenProvider(BaseProvider):
    """Boligsiden.dk — extracts text + follows the realtor redirect to find
    the original source URL (handed back to the orchestrator so it can
    fetch a richer page)."""

    @property
    def name(self) -> str:
        return "Boligsiden.dk"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        try:
            return extract_domain(url) == "boligsiden.dk"
        except Exception:
            return False

    async def parse_html(self, url: str, html_content: str) -> HTMLParseResult:
        try:
            image_url = self.extract_image_url(html_content)
            text = extract_text_from_html(html_content)

            text = _NETBOLIG_NOISE.sub("", text)
            text = _RADON_NOISE.sub("", text)

            original_link = await self._extract_source_url(url) if url else None

            return HTMLParseResult(
                extracted_text=text,
                property_image_url=image_url,
                original_link=original_link,
            )
        except Exception:
            logger.exception("[%s] Failed to parse HTML", self.name)
            return HTMLParseResult()

    async def _extract_source_url(self, url: str) -> str | None:
        match = _UDBUD_PARAM.search(url)
        if not match:
            logger.info("[%s] No case ID found in URL", self.name)
            return None

        case_id = match.group(1)
        redirect_url = f"https://www.boligsiden.dk/viderestilling/{case_id}"
        logger.info("[%s] Following redirect URL: %s", self.name, redirect_url)

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(30.0),
                follow_redirects=True,
                headers={"User-Agent": _USER_AGENT},
            ) as client:
                response = await client.head(redirect_url)
                final_url = str(response.url)
                logger.info("[%s] Resolved to final URL: %s", self.name, final_url)
                return final_url
        except Exception:
            logger.exception("[%s] Failed to extract source URL", self.name)
            return None
