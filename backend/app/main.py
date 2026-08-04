"""Punto de entrada de la API System Status.

Ejecutar en desarrollo desde backend/:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import health, metrics, services
from .core.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "API de monitoreo de recursos del sistema: CPU, memoria, disco, "
        "red, uptime, procesos y servicios Linux."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: permite al frontend de Vite (puerto 5173) consumir la API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(metrics.router, prefix=settings.api_prefix)
app.include_router(services.router, prefix=settings.api_prefix)


@app.get("/", include_in_schema=False)
def root() -> dict:
    """Índice de la API."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/health",
        "metrics": ["/api/metrics/summary", "/api/metrics/processes"],
        "services": "/api/services",
    }
