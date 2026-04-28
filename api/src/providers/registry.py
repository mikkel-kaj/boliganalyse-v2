import logging

from src.providers.base import BaseProvider
from src.providers.boligsiden import BoligsidenProvider
from src.providers.danbolig import DanboligProvider
from src.providers.edc import EdcProvider
from src.providers.fallback import FallbackProvider
from src.providers.firecrawl import FirecrawlProvider
from src.providers.home import HomeProvider
from src.providers.json_ld import JsonLdProvider

logger = logging.getLogger(__name__)


class ProviderNotFoundError(Exception):
    pass


class ProviderRegistry:
    """Singleton holding the ordered provider chain.

    Order matters: each provider's `can_handle` is tried in turn, and the
    first to claim the URL wins. Specialised providers come first;
    Firecrawl + JSON-LD are mid-priority generic options; Fallback is the
    last resort.
    """

    _instance: "ProviderRegistry | None" = None

    def __init__(self) -> None:
        self._providers: list[BaseProvider] = [
            BoligsidenProvider(),
            HomeProvider(),
            DanboligProvider(),
            EdcProvider(),
            FirecrawlProvider(),
            JsonLdProvider(),
            FallbackProvider(),
        ]
        for provider in self._providers:
            logger.info("Registered provider: %s", provider.name)

    @classmethod
    def get_instance(cls) -> "ProviderRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_provider_for_content(self, url: str, html_content: str) -> BaseProvider:
        for provider in self._providers:
            if provider.can_handle(url, html_content):
                logger.info("Using %s provider for URL: %s", provider.name, url)
                return provider

        raise ProviderNotFoundError(f"No provider found that can handle URL: {url}")
