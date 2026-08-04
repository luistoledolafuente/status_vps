"""Application entry point.

Runs in development from backend/ with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Responsibilities:
- build the FastAPI app with CORS and routers
- start/stop the WebSocket broadcast loop (lifespan)
- measure endpoint response times (observability)
"""

import asyncio
import logging
import time
from collections import deque
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import alerts, auth, health, metrics, services
from .api.routes import websocket as ws_routes
from .api.deps import get_current_user
from .core.config import settings
from .core.logging import setup_logging
from .services.alerts import AlertService
from .services.collector import MetricsCollector
from .services.history import HistoryStore
from .ws.manager import manager as ws_manager

logger = logging.getLogger("app.main")

# Rolling window of endpoint response times (observability).
RESPONSE_TIMES: deque = deque(maxlen=50)


async def _broadcast_loop(app: FastAPI) -> None:
    """Pushes live summaries to connected WebSocket clients."""
    while True:
        try:
            if ws_manager.count() > 0:
                collector: MetricsCollector = app.state.collector
                summary = collector.collect_summary()
                app.state.history.record(summary)
                app.state.alerts.evaluate(summary=summary, services=None)
                app.state.last_broadcast_at = summary["collected_at"]
                await ws_manager.broadcast({"type": "metrics", "data": summary})
        except Exception:  # noqa: BLE001 - the loop must never die
            logger.exception("broadcast loop error")
        await asyncio.sleep(settings.ws_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    app.state.started_at = time.monotonic()
    app.state.collector = MetricsCollector(settings, logger)
    app.state.history = HistoryStore(
        max_points=settings.history_max_points,
        snapshot_seconds=settings.history_snapshot_seconds,
    )
    app.state.alerts = AlertService(settings, logger)
    app.state.ws_manager = ws_manager
    app.state.response_times = RESPONSE_TIMES
    app.state.last_broadcast_at = None
    app.state.broadcast_task = asyncio.create_task(_broadcast_loop(app))
    logger.info("application started", extra={"event": "startup", "environment": settings.environment})
    yield
    app.state.broadcast_task.cancel()
    try:
        await app.state.broadcast_task
    except asyncio.CancelledError:
        pass
    logger.info("application stopped", extra={"event": "shutdown"})


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "API profesional de monitoreo: recursos del sistema en tiempo casi "
        "real (REST + WebSocket), procesos, servicios Linux, histórico y alertas."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS: configurable via SYSSTATUS_CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def response_time_middleware(request: Request, call_next):
    """Times every HTTP request and logs it (structured)."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    RESPONSE_TIMES.append(duration_ms)
    logger.info(
        "http request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(duration_ms, 1),
        },
    )
    return response


# Auth is opt-in: when SYSSTATUS_AUTH_ENABLED=true every API route requires
# a valid JWT (the auth router itself stays open to issue tokens).
app.include_router(health.router, prefix=settings.api_prefix, dependencies=[Depends(get_current_user)])
app.include_router(metrics.router, prefix=settings.api_prefix, dependencies=[Depends(get_current_user)])
app.include_router(services.router, prefix=settings.api_prefix, dependencies=[Depends(get_current_user)])
app.include_router(alerts.router, prefix=settings.api_prefix, dependencies=[Depends(get_current_user)])
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(ws_routes.router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    """API index."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/health",
        "metrics": ["/api/metrics/summary", "/api/metrics/processes", "/api/metrics/history"],
        "services": "/api/services",
        "alerts": "/api/alerts",
        "auth": "/api/auth/token",
        "websocket": "/ws/metrics",
    }