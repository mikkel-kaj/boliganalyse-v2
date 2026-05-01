from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.types.models import HomeLeadIdentity

_HOME_PRIVACY_POLICY_HTML = (
    '<p>Læs mere om homes behandling af personoplysninger i homes privatlivspolitik '
    '<strong><a rel="noopener" href="https://home.dk/om-home/politikker/privatlivspolitik/" '
    'target="_blank" title="Privatlivspolitik">her</a></strong></p>\n'
    '<p>Se den fulde liste med de op til 175 home ejendomsmæglerforretninger '
    '<a href="https://home.dk/soeg-maegler/" title="Søg mægler"><strong>her</strong></a></p>'
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")

    anthropic_api_key: str = Field(..., alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field("claude-opus-4-7", alias="ANTHROPIC_MODEL")
    anthropic_max_tokens: int = Field(16000, alias="ANTHROPIC_MAX_TOKENS")

    firecrawl_api_key: str = Field("", alias="FIRECRAWL_API_KEY")

    enable_dst_tools: bool = Field(True, alias="ENABLE_DST_TOOLS")

    cors_origins: str = Field("http://localhost:8080", alias="CORS_ORIGINS")

    log_level: str = Field("info", alias="LOG_LEVEL")

    http_timeout_seconds: float = 30.0
    http_retry_attempts: int = 3
    max_tool_turns: int = 3
    max_tool_result_chars: int = 6000

    home_lead_first_name: str = "Boliganalyse"
    home_lead_last_name: str = "AI"
    home_lead_phone: str = "+4512345678"
    home_lead_postal_code: str = "2100"
    home_lead_privacy_policy_html: str = _HOME_PRIVACY_POLICY_HTML
    home_lead_purpose_text_headline_html: str = (
        "<p><strong>*Bestilling af salgsmateriale og eventuelt samtykke til mæglerkontakt:</strong></p>"
    )
    inbox_domain: str = "inbox.boliganalyse.ai"

    # No semantic default: a missing/empty secret means the webhook rejects
    # everything (the route checks `not x_inbound_secret` first). Production
    # deploys must set INBOUND_EMAIL_SECRET in /opt/supabase-stack/.env.
    inbound_email_secret: str = Field("", alias="INBOUND_EMAIL_SECRET")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def build_home_lead_identity(self) -> HomeLeadIdentity:
        return HomeLeadIdentity(
            first_name=self.home_lead_first_name,
            last_name=self.home_lead_last_name,
            phone=self.home_lead_phone,
            postal_code=self.home_lead_postal_code,
            privacy_policy_html=self.home_lead_privacy_policy_html,
            purpose_text_headline_html=self.home_lead_purpose_text_headline_html,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
