import asyncio
import logging

import httpx

from src.providers.registry import ProviderNotFoundError, ProviderRegistry
from src.repositories.listing import ListingRepository
from src.services.ai_analyzer import AIAnalyzerService
from src.types.models import HTMLParseResult
from src.types.status import AnalysisStatus
from src.utils.url import extract_domain

logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
)
_HTTP_TIMEOUT = httpx.Timeout(30.0)
_PROCESSING_DEADLINE_SECONDS = 600  # 10 min — generous because no edge wall clock


class ListingProcessorService:
    """Orchestrates the full pipeline for a single listing:

    1. Fetch HTML from the listing URL.
    2. Pick a provider that can parse it.
    3. If the provider returns an `original_link` (e.g. Boligsiden →
       realtor's own page), fetch + re-parse that too.
    4. Persist raw HTML + extracted text for audit.
    5. Run the Claude analysis on the combined text.
    6. Save the result.

    Status updates are written to the DB at each transition so the SSE
    stream can flush them to the frontend in near-real time.
    """

    def __init__(
        self,
        repository: ListingRepository,
        *,
        ai_analyzer: AIAnalyzerService | None = None,
        provider_registry: ProviderRegistry | None = None,
    ) -> None:
        self._repository = repository
        self._ai_analyzer = ai_analyzer or AIAnalyzerService(initialize_tools=True)
        self._provider_registry = provider_registry or ProviderRegistry.get_instance()

    async def process_listing(self, listing_id: str, url: str) -> bool:
        try:
            await asyncio.wait_for(
                self._process_inner(listing_id, url),
                timeout=_PROCESSING_DEADLINE_SECONDS,
            )
            return True
        except asyncio.TimeoutError:
            logger.warning("Processing timeout for listing %s", listing_id)
            await self._repository.set_error_status(
                listing_id,
                "Processing timed out",
                status=AnalysisStatus.TIMEOUT,
            )
            return False
        except Exception as exc:  # noqa: BLE001
            logger.exception("Processing failed for listing %s", listing_id)
            await self._repository.set_error_status(listing_id, exc)
            return False

    async def _process_inner(self, listing_id: str, url: str) -> None:
        logger.info("Starting processing for listing %s", listing_id)

        await self._repository.update_status(listing_id, AnalysisStatus.FETCHING_HTML)
        html_content = await self._fetch_html(url)
        if not html_content:
            raise RuntimeError("Failed to fetch HTML content")

        try:
            provider = self._provider_registry.get_provider_for_content(url, html_content)
        except ProviderNotFoundError as exc:
            logger.error("No suitable provider for URL: %s", url)
            raise RuntimeError(
                "No suitable provider found for this listing. "
                "Please try a supported provider like boligsiden.dk, home.dk, "
                "or a site using JSON-LD."
            ) from exc

        await self._repository.update_status(listing_id, AnalysisStatus.PARSING_DATA)
        parse_result = await provider.parse_html(url, html_content)

        original_html: str | None = None
        original_parse: HTMLParseResult | None = None
        original_url: str | None = None

        if parse_result.original_link and parse_result.original_link != url:
            await self._repository.update_status(
                listing_id, AnalysisStatus.PREPARING_ANALYSIS
            )
            original_url = parse_result.original_link
            original_html = await self._fetch_html(original_url)
            logger.info("Fetched HTML from original source: %s", original_url)

            try:
                source_provider = self._provider_registry.get_provider_for_content(
                    original_url, original_html
                )
                original_parse = await source_provider.parse_html(original_url, original_html)
            except ProviderNotFoundError:
                logger.warning(
                    "No provider for original-source URL %s; continuing with primary only",
                    original_url,
                )

        await self._repository.update_listing_metadata(
            listing_id,
            text_primary=parse_result.extracted_text,
            text_redirect=original_parse.extracted_text if original_parse else None,
            html_primary=html_content,
            html_redirect=original_html,
            url_redirect=original_url,
            property_image_url=parse_result.property_image_url,
            realtor=extract_domain(original_url or url),
        )

        await self._repository.update_status(
            listing_id, AnalysisStatus.GENERATING_INSIGHTS
        )
        analysis = await self._ai_analyzer.analyze_multiple_texts(
            parse_result, original_parse
        )

        await self._repository.update_status(listing_id, AnalysisStatus.FINALIZING)
        await self._repository.save_analysis_result(listing_id, analysis)
        logger.info("Processing completed for listing %s", listing_id)

    @staticmethod
    async def _fetch_html(url: str) -> str:
        async with httpx.AsyncClient(
            timeout=_HTTP_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.text
