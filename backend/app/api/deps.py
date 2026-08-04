"""Shared dependencies: authentication, authorization, rate limiting and
helpers to access shared services (collector, history, alerts, ws manager)
from the app state.
"""

import time
from collections import defaultdict, deque
from statistics import mean
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from ..core import security
from ..core.config import settings
from ..schemas.auth import UserInfo
from ..services.alerts import AlertService
from ..services.collector import MetricsCollector
from ..services.history import HistoryStore


# --- App state helpers ------------------------------------------------------

def get_collector(request: Request) -> MetricsCollector:
    return request.app.state.collector


def get_history(request: Request) -> HistoryStore:
    return request.app.state.history


def get_alert_service(request: Request) -> AlertService:
    return request.app.state.alerts


def get_observability_state(request: Request) -> dict:
    """Packs observability info used by the health endpoint."""
    response_times: deque = request.app.state.response_times
    avg_ms = round(mean(response_times), 1) if response_times else None
    collector: MetricsCollector = request.app.state.collector
    ws_manager = request.app.state.ws_manager
    started_at = request.app.state.started_at
    uptime_seconds = max(0, int(time.monotonic() - started_at))
    return {
        "last_collection_at": collector.last_collection_at,
        "ws_clients": ws_manager.count(),
        "last_broadcast_at": request.app.state.last_broadcast_at,
        "avg_response_ms": avg_ms,
        "collector_error_count": collector.error_count(),
        "collector_recent_errors": collector.recent_errors(limit=5),
        "api_uptime_seconds": uptime_seconds,
    }


# --- Authentication and authorization ---------------------------------------

def get_current_user(request: Request) -> UserInfo:
    """Resolves the caller identity. Always returns a UserInfo (even when
    the system runs with auth disabled)."""
    if not settings.auth_enabled:
        return UserInfo(username="development", role="admin", authenticated=False)

    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token requerido. Inicia sesión en /api/auth/token.",
        )
    try:
        payload = security.decode_token(header[7:])
    except Exception:  # noqa: BLE001 - any decode error means invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        ) from None
    role = payload.get("role", "viewer")
    if role not in ("admin", "viewer"):
        role = "viewer"
    return UserInfo(username=payload.get("sub", "?"), role=role, authenticated=True)


def require_role(role: str) -> Callable:
    """Dependency factory for role-based authorization (admin / viewer)."""

    def _checker(user: UserInfo = Depends(get_current_user)) -> UserInfo:
        if settings.auth_enabled and user.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes.")
        return user

    return _checker


# --- Rate limiting (prepared, disabled by default) --------------------------

class _RateLimiter:
    """Fixed 1-minute window limiter per client IP."""

    def __init__(self, limit: int):
        self._limit = limit
        self._hits: dict[str, deque] = defaultdict(deque)

    def hit(self, client_ip: str) -> bool:
        now = time.monotonic()
        window = self._hits[client_ip]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self._limit:
            return False
        window.append(now)
        return True


_rate_limiter = _RateLimiter(settings.rate_limit_per_minute)


def rate_limit(request: Request) -> None:
    if not settings.rate_limit_enabled:
        return
    client_ip = request.client.host if request.client else "unknown"
    if not _rate_limiter.hit(client_ip):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Demasiadas peticiones.")