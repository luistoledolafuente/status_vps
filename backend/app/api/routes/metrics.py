"""Endpoints de métricas del sistema."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Query

from ...core.config import settings
from ...schemas.metrics import ProcessesResponse, SummaryMetrics
from ...services import system_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/summary", response_model=SummaryMetrics)
def get_summary() -> dict:
    """Resumen general: CPU, memoria, disco, red, uptime y carga del sistema."""
    return system_metrics.get_summary()


@router.get("/processes", response_model=ProcessesResponse)
def get_processes(
    limit: int = Query(default=10, ge=1, le=settings.max_processes),
    sort_by: Literal["cpu", "memory", "name"] = Query(default="cpu"),
) -> ProcessesResponse:
    """Procesos más pesados por CPU, memoria o nombre."""
    checked, processes = system_metrics.get_processes(limit=limit, sort_by=sort_by)
    return ProcessesResponse(
        limit=limit,
        checked=checked,
        sort_by=sort_by,
        processes=processes,
        collected_at=_now_iso(),
    )