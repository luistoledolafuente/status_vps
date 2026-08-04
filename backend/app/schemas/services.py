"""Schemas (DTO) for Linux service status."""

from typing import Literal, Optional

from pydantic import BaseModel


class ServiceInfo(BaseModel):
    name: str
    description: str = ""
    load_state: str = "loaded"
    active_state: str = "unknown"
    sub_state: str = "unknown"
    # Human friendly label in Spanish.
    label: str = "Desconocido"


class TrackedService(BaseModel):
    """Status of a named service being monitored (configured in settings)."""

    name: str
    state: Literal["active", "inactive", "failed", "not_found", "error", "unknown"]
    label: str
    active_state: Optional[str] = None


class ServicesResponse(BaseModel):
    available: bool
    manager: Optional[str] = None
    detail: str = ""
    services: list[ServiceInfo] = []
    counts: dict[str, int] = {}
    tracked: list[TrackedService] = []