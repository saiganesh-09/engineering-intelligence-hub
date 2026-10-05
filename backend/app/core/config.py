"""Application configuration loaded from environment variables."""
from functools import lru_cache
from pathlib import Path

import os

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings.

    Every value can be overridden via environment variables or a ``.env`` file.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Core ---
    app_name: str = "Engineering Intelligence Hub"
    environment: str = "development"
    debug: bool = True

    # --- Database ---
    # e.g. postgresql+psycopg://eih:eih@localhost:5432/eih
    database_url: str = "postgresql+psycopg://eih:eih@localhost:5432/eih"

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_db_scheme(cls, v: str) -> str:
        # PaaS providers (Railway, Render, Heroku) hand out bare
        # postgresql:// / postgres:// URLs; we need the psycopg v3 driver.
        if isinstance(v, str):
            if v.startswith("postgresql://"):
                return "postgresql+psycopg://" + v[len("postgresql://"):]
            if v.startswith("postgres://"):
                return "postgresql+psycopg://" + v[len("postgres://"):]
        return v

    @model_validator(mode="after")
    def _fallback_db_env(self) -> "Settings":
        # Vercel-integrated databases inject POSTGRES_URL / POSTGRES_URL_NON_POOLING.
        if "DATABASE_URL" not in os.environ:
            for alt in ("POSTGRES_URL_NON_POOLING", "POSTGRES_URL"):
                v = os.environ.get(alt)
                if v:
                    object.__setattr__(self, "database_url", v)
                    break
        return self

    # --- Auth / JWT ---
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h

    # --- LLM provider abstraction ---
    # Any OpenAI-compatible endpoint works (OpenAI, Azure, Gemini compat, local).
    llm_provider: str = "openai"  # openai | mock
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: int = 120

    # --- Embeddings ---
    embedding_provider: str = "openai"  # openai | local | mock
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    # Optional local model name (sentence-transformers) when provider == "local"
    embedding_local_model: str = "all-MiniLM-L6-v2"

    # --- RAG ---
    rag_top_k: int = 8
    rag_candidate_k: int = 24  # candidates fetched before re-ranking/dedup
    rag_min_score: float = 0.08

    # --- GitHub ---
    github_token: str = ""  # optional PAT for private repos / higher rate limits
    github_client_id: str = ""
    github_client_secret: str = ""

    # --- Storage ---
    storage_dir: Path = Path("storage")  # uploaded docs + cloned repos
    max_upload_mb: int = 25
    max_repo_mb: int = 200

    # --- CORS ---
    frontend_url: str = "http://localhost:3000"

    # --- Rate limiting ---
    rate_limit_per_minute: int = 120

    # Run indexing inline instead of as a background task — required on
    # serverless hosts that freeze the process after the response is sent.
    sync_background: bool = False

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"prod", "production"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
