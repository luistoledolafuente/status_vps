"""Esquemas (DTO) del estado de servicios Linux."""

from typing import Optional

from pydantic import BaseModel


class ServiceInfo(BaseModel):
    name: str
    description: str = ""
    load_state: str = "loaded"
    active_state: str = "unknown"
    sub_state: str = "unknown"
    # Traducción al español del estado para usuarios no técnicos.
    label: str = "Desconocido"


class ServicesResponse(BaseModel):
    available: bool
    manager: Optional[str] = None
    detail: str = ""
    services: list[ServiceInfo] = []
    counts: dict[str, int] = {}