"""Services endpoint: full list plus tracked services."""

from fastapi import APIRouter, Depends

from ...schemas.services import ServicesResponse
from ..deps import get_alert_service, get_collector, rate_limit
from ...services.alerts import AlertService
from ...services.collector import MetricsCollector

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=ServicesResponse, dependencies=[Depends(rate_limit)])
def list_services(
    collector: MetricsCollector = Depends(get_collector),
    alerts: AlertService = Depends(get_alert_service),
) -> ServicesResponse:
    """Servicios del sistema (systemd/SysV) con degradación controlada y
    estado de los servicios en seguimiento (nginx, postgresql, ...)."""
    response = collector.collect_services()
    alerts.evaluate(summary=None, services=response)
    return response