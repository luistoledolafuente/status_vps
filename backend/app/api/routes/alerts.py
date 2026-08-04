"""Alerts endpoint."""

from fastapi import APIRouter, Depends

from ...schemas.alerts import AlertsResponse
from ..deps import get_alert_service, rate_limit
from ...services.alerts import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertsResponse, dependencies=[Depends(rate_limit)])
def get_alerts(alerts: AlertService = Depends(get_alert_service)) -> dict:
    """Alertas activas y resueltas recientemente, con los umbrales vigentes."""
    return alerts.snapshot()