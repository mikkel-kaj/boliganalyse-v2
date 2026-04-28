from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    anthropic_max_tokens: int = Field(8000, alias="ANTHROPIC_MAX_TOKENS")

    firecrawl_api_key: str = Field("", alias="FIRECRAWL_API_KEY")

    enable_dst_tools: bool = Field(True, alias="ENABLE_DST_TOOLS")

    cors_origins: str = Field("http://localhost:8080", alias="CORS_ORIGINS")

    log_level: str = Field("info", alias="LOG_LEVEL")

    http_timeout_seconds: float = 30.0
    http_retry_attempts: int = 3
    max_tool_turns: int = 3
    max_tool_result_chars: int = 6000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
