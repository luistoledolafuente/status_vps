"""Central application configuration using pydantic-settings.

All environment variables use the SYSSTATUS_ prefix and are loaded from an
optional .env file (see backend/.env.example). This module is the single
source of truth for application settings.
"""

from functools import lru_cache

from pydantic import Field
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
    history_db_path: str = "data/history.db"
    history_retention_days: int = 30

    # --- Alert thresholds (percentages) -----------------------------------
    alert_cpu_warning: float = 80.0
    alert_cpu_critical: float = 90.0
    alert_memory_warning: float = 80.0
    alert_memory_critical: float = 90.0
    alert_disk_warning: float = 80.0
    alert_disk_critical: float = 90.0

    # --- Alert behavior ----------------------------------------------------
    # Seconds a threshold must stay breached before an alert fires (avoids
    # false alarms on momentary spikes).
    alert_sustain_seconds: float = 30.0

    # --- Webhook notifications (empty URL disables) -----------------------
    webhook_url: str = ""
    webhook_timeout_seconds: int = 10

    # --- Monthly traffic vs. plan quota (0 GB disables) --------------------
    traffic_quota_gb: float = 0.0
    traffic_warning_percent: float = 80.0
    traffic_critical_percent: float = 95.0

    # --- Availability checks ("name=http://host:port,ssh=tcp://host:22") --
    checks_raw: str = Field(default="", validation_alias="SYSSTATUS_CHECKS")
    checks_interval_seconds: float = 30.0

    @property
    def checks(self) -> list[tuple[str, str]]:
        """Parses the checks configuration into (name, target) pairs.

        Entries use the form `name=target`; the target must include an
        explicit scheme: http(s):// for HTTP probes or tcp:// for TCP ones.
        Malformed entries are skipped.
        """
        parsed: list[tuple[str, str]] = []
        for entry in self.checks_raw.split(","):
            entry = entry.strip()
            if not entry:
                continue
            name, sep, target = entry.partition("=")
            name = name.strip()
            target = target.strip()
            if not sep or not name or not target:
                continue
            if target.startswith(("http://", "https://", "tcp://")):
                parsed.append((name, target))
        return parsed

    # --- Anomaly score ------------------------------------------------------
    anomaly_critical: float = 80.0
    anomaly_window_minutes: int = 120

    # --- Tracked services (comma-separated list) --------------------------
    tracked_services_raw: str = "nginx,postgresql,redis,ssh,cron"

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
