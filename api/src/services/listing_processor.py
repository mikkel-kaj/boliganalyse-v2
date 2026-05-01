import asyncio
import logging

import httpx

from src.config import get_settings
from src.documents import mindworking as mindworking_module
from src.documents.extractors.danbolig import extract_danbolig_documents
from src.documents.extractors.home import extract_home_listing_metadata
from src.documents.pipeline import ingest_documents
from src.documents.storage import DocumentStorage
from src.documents.submitters.home import (
    HomeLeadSubmissionError,
    submit_sales_material_lead,
)
from src.providers.base import BaseProvider
from src.providers.registry import ProviderNotFoundError, ProviderRegistry
from src.repositories.document import DocumentRepository
from src.repositories.listing import ListingRepository
from src.services.ai_analyzer import AIAnalyzerService
from src.types.models import DocumentRef, HTMLParseResult
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
        document_storage: DocumentStorage | None = None,
        document_repository: DocumentRepository | None = None,
        mindworking_fetcher: object | None = None,
        home_submitter: object | None = None,
        home_metadata_extractor: object | None = None,
    ) -> None:
        self._repository = repository
        self._ai_analyzer = ai_analyzer or AIAnalyzerService(initialize_tools=True)
        self._provider_registry = provider_registry or ProviderRegistry.get_instance()
        self._document_storage = document_storage
        self._document_repository = document_repository
        self._mindworking_fetcher = mindworking_fetcher or mindworking_module
        self._home_submitter = home_submitter or submit_sales_material_lead
        self._home_metadata_extractor = (
            home_metadata_extractor or extract_home_listing_metadata
        )

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

        await self._maybe_ingest_provider_documents(listing_id, provider, html_content)

        if await self._maybe_submit_home_lead(listing_id, provider, html_content):
            # Persist what we have so the awaiting_documents card can show
            # the listing image + realtor, and complete_with_documents() has
            # html_primary to feed back into the analyser when the broker
            # email lands. Without this, html_primary stays NULL and the
            # post-email analyse() call has nothing to work from.
            await self._repository.update_listing_metadata(
                listing_id,
                text_primary=parse_result.extracted_text,
                html_primary=html_content,
                property_image_url=parse_result.property_image_url,
                realtor=extract_domain(url),
            )
            return

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

    async def complete_with_documents(
        self,
        listing_id: str,
        document_urls: list[str],
        *,
        source_email_id: str | None = None,
    ) -> bool:
        """Resume a Home pipeline that halted in `awaiting_documents`.

        Ingests the documents extracted from the inbound email, then runs
        the analysis steps that were skipped after the lead form was
        submitted. Returns True on success, False if the listing is no
        longer in `awaiting_documents` (already finished or failed).
        """
        # Use get_for_resume so html_primary + text_primary are loaded —
        # the analyser needs them and they're not in the public projection.
        listing = await self._repository.get_for_resume(listing_id)
        if listing is None:
            logger.warning(
                "complete_with_documents: listing %s not found", listing_id
            )
            return False

        current_status = listing.get("status")
        if current_status != AnalysisStatus.AWAITING_DOCUMENTS.value:
            logger.warning(
                "complete_with_documents: listing %s is in status %s, not awaiting_documents",
                listing_id,
                current_status,
            )
            return False

        try:
            await self._ingest_email_documents(
                listing_id, document_urls, source_email_id=source_email_id
            )

            html_primary = listing.get("html_primary")
            url = listing.get("url") or ""
            primary_parse = await self._reparse_cached_html(url, html_primary)

            await self._repository.update_status(
                listing_id, AnalysisStatus.PREPARING_ANALYSIS
            )
            await self._repository.update_status(
                listing_id, AnalysisStatus.ANALYZING
            )
            await self._repository.update_status(
                listing_id, AnalysisStatus.GENERATING_INSIGHTS
            )
            analysis = await self._ai_analyzer.analyze_multiple_texts(
                primary_parse, None
            )

            await self._repository.update_status(
                listing_id, AnalysisStatus.FINALIZING
            )
            await self._repository.save_analysis_result(listing_id, analysis)
            logger.info(
                "complete_with_documents: finished analysis for listing %s",
                listing_id,
            )
            return True
        except Exception as exc:
            logger.exception(
                "complete_with_documents: failed for listing %s", listing_id
            )
            await self._repository.set_error_status(listing_id, exc)
            return False

    async def _ingest_email_documents(
        self,
        listing_id: str,
        document_urls: list[str],
        *,
        source_email_id: str | None = None,
    ) -> None:
        if not document_urls:
            return

        refs = [
            DocumentRef(url=url, filename_hint="", kind="", source_url=url)
            for url in document_urls
        ]

        storage = self._document_storage
        repo = self._document_repository
        if storage is None:
            from supabase import acreate_client

            settings = get_settings()
            client = await acreate_client(
                settings.supabase_url, settings.supabase_service_role_key
            )
            storage = DocumentStorage(client)
        if repo is None:
            repo = await DocumentRepository.create()

        await ingest_documents(
            listing_id,
            refs,
            mindworking=self._mindworking_fetcher,
            storage=storage,
            repo=repo,
            source_email_id=source_email_id,
        )

    async def _reparse_cached_html(
        self, url: str, html_content: str | None
    ) -> HTMLParseResult:
        if not html_content:
            return HTMLParseResult(extracted_text="")
        try:
            provider = self._provider_registry.get_provider_for_content(
                url, html_content
            )
            return await provider.parse_html(url, html_content)
        except ProviderNotFoundError:
            logger.warning(
                "complete_with_documents: no provider for cached HTML at %s; "
                "falling back to raw HTML",
                url,
            )
            return HTMLParseResult(extracted_text=html_content)

    async def _maybe_ingest_provider_documents(
        self, listing_id: str, provider: BaseProvider, html_content: str
    ) -> None:
        """Best-effort document ingestion for providers that expose them.

        Currently only Danbolig is wired. Any failure is logged and
        swallowed — document ingestion never breaks the analysis run.
        """
        if provider.name != "Danbolig":
            return

        try:
            refs = extract_danbolig_documents(html_content)
        except Exception:
            logger.exception(
                "Danbolig document extraction failed for listing %s", listing_id
            )
            return

        if not refs:
            return

        try:
            storage = self._document_storage
            repo = self._document_repository
            if storage is None:
                from supabase import acreate_client

                from src.config import get_settings

                settings = get_settings()
                client = await acreate_client(
                    settings.supabase_url, settings.supabase_service_role_key
                )
                storage = DocumentStorage(client)
            if repo is None:
                repo = await DocumentRepository.create()

            await ingest_documents(
                listing_id,
                refs,
                mindworking=self._mindworking_fetcher,
                storage=storage,
                repo=repo,
            )
        except Exception:
            logger.exception(
                "Danbolig document ingestion failed for listing %s", listing_id
            )

    async def _maybe_submit_home_lead(
        self, listing_id: str, provider: BaseProvider, html_content: str
    ) -> bool:
        """For Home.dk listings, request sales material via the lead form and
        halt the pipeline until docs arrive (handled by inbound webhook).

        Returns True when the pipeline should stop (lead submitted, status
        is now `awaiting_documents`). Returns False to continue with normal
        analysis — either because the provider isn't Home, metadata
        extraction failed, or the lead submission failed (best-effort
        fallback so the listing isn't stuck).
        """
        if provider.name != "Home.dk":
            return False

        metadata = self._home_metadata_extractor(html_content)
        if metadata is None:
            logger.warning(
                "Home metadata extraction failed for listing %s — "
                "continuing with normal analysis",
                listing_id,
            )
            return False

        settings = get_settings()
        identity = settings.build_home_lead_identity()
        try:
            await self._home_submitter(
                metadata,
                listing_id=listing_id,
                identity=identity,
                inbox_domain=settings.inbox_domain,
            )
        except HomeLeadSubmissionError:
            logger.exception(
                "Home lead submission failed for listing %s — "
                "falling back to analysis",
                listing_id,
            )
            return False
        except Exception:
            logger.exception(
                "Home lead submission failed for listing %s — "
                "falling back to analysis",
                listing_id,
            )
            return False

        await self._repository.set_email_lead_sent(listing_id)
        return True

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
