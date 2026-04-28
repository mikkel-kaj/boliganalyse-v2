from src.providers.json_ld import JsonLdProvider


class EdcProvider(JsonLdProvider):
    """edc.dk uses JSON-LD; this subclass just gates can_handle on the domain."""

    @property
    def name(self) -> str:
        return "EdcProvider"

    def can_handle(self, url: str, html_content: str | None = None) -> bool:
        return "edc.dk" in url and super().can_handle(url, html_content)
