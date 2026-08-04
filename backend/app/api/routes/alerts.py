"""Alerts endpoint."""

from fastapi import APIRouter, Depends

from ...schemas.alerts import AlertsResponse
from ..deps import get_alert_service, get_notifier, rate_limit
from ...services.alerts import AlertService
from ...services.notifications import WebhookNotifier

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertsResponse, dependencies=[Depends(rate_limit)])
def get_alerts(alerts: AlertService = Depends(get_alert_service)) -> dict:
    """Alertas activas y resueltas recientemente, con los umbrales vigentes."""
    return alerts.snapshot()


@router.post("/test", dependencies=[Depends(rate_limit)])
def test_alerts(notifier: WebhookNotifier = Depends(get_notifier)) -> dict:
    """Envía una notificación de prueba al webhook configurado, si existe."""
    if not notifier.enabled:
        return {"configured": False, "sent": False, "message": "No se configuró un webhook (SYSSTATUS_WEBHOOK_URL)."}
    sent = notifier.send_test()
    return {"configured": True, "sent": sent, "message": "Notificación de prueba enviada." if sent else "La entrega falló; revisa los logs del backend."}