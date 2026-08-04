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
    state: Literal[
        "active",
        "inactive",
        "failed",
        "not_found",
        "unreachable",
        "error",
        "unknown",
    ]
    label: str
    active_state: Optional[str] = None
    # How the state was resolved (systemd / sysv / socket / proceso / ninguno).
    source: Optional[str] = None
    # Optional actionable hint shown next to the status.
    hint: str = ""


class ServicesResponse(BaseModel):
    available: bool
    manager: Optional[str] = None
    detail: str = ""
    services: list[ServiceInfo] = []
    counts: dict[str, int] = {}
    tracked: list[TrackedService] = []