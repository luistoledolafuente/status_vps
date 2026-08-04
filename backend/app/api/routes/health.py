"""Endpoint de salud del servicio."""

from datetime import datetime, timezone

from fastapi import APIRouter

from ...core.config import settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def get_health() -> dict:
    """Verificación rápida de que la API está viva."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "time": datetime.now(timezone.utc).isoformat(),
    }
