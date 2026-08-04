"""Health and observability endpoint."""

from fastapi import APIRouter, Depends

from ...core.config import settings
from ...core.logging import get_logger
from ..deps import get_observability_state, rate_limit

logger = get_logger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", dependencies=[Depends(rate_limit)])
def get_health(state: dict = Depends(get_observability_state)) -> dict:
    """API liveness plus internal observability (response times, WS clients,
    collector errors and last collection time)."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "auth_enabled": settings.auth_enabled,
        "server_time": state["last_collection_at"],
        **state,
    }