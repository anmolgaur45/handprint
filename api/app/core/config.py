"""Application settings loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration.

    All values come from env vars or .env file.  Secrets are never
    hard-coded.
    """

    # --- app ---
    app_name: str = "handprint-api"
    debug: bool = False
    allowed_origins: list[str] = ["http://localhost:3000"]

    # --- gcp ---
    gcp_project_id: str = "handprint"
    gcp_region: str = "asia-south1"

    # --- vertex ai (model string pinned here per §3) ---
    vertex_model: str = "gemini-2.0-flash"

    # --- google maps platform ---
    maps_api_key: str = ""

    # --- firebase ---
    firebase_credentials_path: str = ""

    # --- rate limiting ---
    rate_limit_requests: int = 20
    rate_limit_window_seconds: int = 60

    # --- body size cap ---
    max_body_size_bytes: int = 16_384  # 16 KiB

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()
