"""Schemas (DTO) for alerts."""

from typing import Literal, Optional

from pydantic import BaseModel

Severity = Literal["info", "warning", "critical"]
AlertState = Literal["active", "resolved"]


class AlertInfo(BaseModel):
    id: str
    key: str
    severity: Severity
    title: str
    message: str
    tip: str
    state: AlertState
    metric: Optional[str] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    first_seen: str
    last_seen: str
    resolved_at: Optional[str] = None


class AlertThresholds(BaseModel):
    cpu_warning: float
    cpu_critical: float
    memory_warning: float
    memory_critical: float
    disk_warning: float
    disk_critical: float


class AlertsResponse(BaseModel):
    active_count: int
    thresholds: AlertThresholds
    alerts: list[AlertInfo]