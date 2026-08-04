"""Configuración central de la aplicación (variables de entorno con valores por defecto)."""

import os
from dataclasses import dataclass, field


def _parse_cors_origins(raw: str) -> list[str]:
    """Convierte una lista separada por comas en una lista de orígenes CORS."""
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "System Status API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api"
    environment: str = field(default_factory=lambda: os.getenv("SYSSTATUS_ENV", "development"))

    # Orígenes permitidos para el frontend (Vite dev usa el puerto 5173).
    cors_origins: list[str] = field(
        default_factory=lambda: _parse_cors_origins(
            os.getenv(
                "SYSSTATUS_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            )
        )
    )

    # Límite por defecto para el endpoint de procesos.
    max_processes: int = int(os.getenv("SYSSTATUS_MAX_PROCESSES", "20"))


settings = Settings()
