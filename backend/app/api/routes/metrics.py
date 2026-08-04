"""Metrics endpoints: summary, processes and history."""

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query

from ...core.config import settings
from ...schemas.metrics import HistoryResponse, ProcessesResponse, SummaryMetrics
from ..deps import get_alert_service, get_collector, get_history, rate_limit
from ...services.alerts import AlertService
from ...services.collector import MetricsCollector
from ...services.history import HistoryStore

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get(
    "/summary",
    response_model=SummaryMetrics,
    dependencies=[Depends(rate_limit)],
)
def get_summary(
    collector: MetricsCollector = Depends(get_collector),
    history: HistoryStore = Depends(get_history),
    alerts: AlertService = Depends(get_alert_service),
) -> dict:
    """Resumen completo: CPU, memoria, disco por partición, red, uptime y carga."""
    summary = collector.collect_summary()
    history.record(summary)
    alerts.evaluate(summary=summary, services=None)
    return summary


@router.get(
    "/processes",
    response_model=ProcessesResponse,
    dependencies=[Depends(rate_limit)],
)
def get_processes(
    limit: int = Query(default=10, ge=1, le=settings.max_processes),
    sort_by: Literal["cpu", "memory", "name"] = Query(default="cpu"),
    collector: MetricsCollector = Depends(get_collector),
) -> ProcessesResponse:
    """Procesos más pesados por CPU, memoria o nombre."""
    checked, processes = collector.collect_processes(limit=limit, sort_by=sort_by)
    return ProcessesResponse(
        limit=limit,
        checked=checked,
        sort_by=sort_by,
        processes=processes,
        collected_at=_now_iso(),
    )


@router.get(
    "/history",
    response_model=HistoryResponse,
    dependencies=[Depends(rate_limit)],
)
def get_history(
    limit: int = Query(default=200, ge=1, le=settings.history_max_points),
    since: Optional[str] = Query(default=None, description="Filtra puntos posteriores a este ISO timestamp"),
    history: HistoryStore = Depends(get_history),
) -> HistoryResponse:
    """Histórico de snapshots (CPU, memoria, disco, red). Almacenamiento: memoria."""
    return HistoryResponse(
        storage=history.STORAGE_NAME,
        interval_seconds=history.snapshot_seconds,
        points=history.points(since=since, limit=limit),
    )