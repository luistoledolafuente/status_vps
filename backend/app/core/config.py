"""Central application configuration using pydantic-settings.

All environment variables use the SYSSTATUS_ prefix and are loaded from an
optional .env file (see backend/.env.example). This module is the single
source of truth for application settings.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SYSSTATUS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application -------------------------------------------------------
    app_name: str = "System Status API"
    app_version: str = "2.0.0"
    environment: str = "development"
    api_prefix: str = "/api"

    # --- CORS (comma-separated list) --------------------------------------
    cors_origins_raw: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]

    # --- Security (optional JWT) ------------------------------------------
    auth_enabled: bool = False
    admin_username: str = "admin"
    admin_password: str = "admin123"
    viewer_username: str = "viewer"
    viewer_password: str = "viewer123"
    jwt_secret: str = "cambia-este-secreto-en-produccion"
    jwt_algorithm: str = "HS256"
    token_expire_minutes: int = 60

    # --- Collection and real time -----------------------------------------
    ws_interval_seconds: float = 2.0
    max_processes: int = 25

    # --- History -----------------------------------------------------------
    history_max_points: int = 3600
    history_snapshot_seconds: int = 15

    # --- Alert thresholds (percentages) -----------------------------------
    alert_cpu_warning: float = 80.0
    alert_cpu_critical: float = 90.0
    alert_memory_warning: float = 80.0
    alert_memory_critical: float = 90.0
    alert_disk_warning: float = 80.0
    alert_disk_critical: float = 90.0

    # --- Tracked services (comma-separated list) --------------------------
    tracked_services_raw: str = "nginx,docker,postgresql,redis,ssh,cron"

    @property
    def tracked_services(self) -> list[str]:
        return [n.strip() for n in self.tracked_services_raw.split(",") if n.strip()]

    # --- Rate limiting (prepared for production) ---------------------------
    rate_limit_enabled: bool = False
    rate_limit_per_minute: int = 120

    # --- Logging ------------------------------------------------------------
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
