"""Endpoint de estado de servicios del sistema."""

from fastapi import APIRouter

from ...schemas.services import ServicesResponse
from ...services import linux_services

router = APIRouter(prefix="/services", tags=["services"])


@router.get("", response_model=ServicesResponse)
def list_services() -> ServicesResponse:
    """Servicios del sistema (systemd o SysV) con degradación controlada."""
    return linux_services.get_services()