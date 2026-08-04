"""Esquemas (DTO) de las métricas del sistema."""

from typing import Literal, Optional

from pydantic import BaseModel


class CPUInfo(BaseModel):
    percent: float
    cores: int
    logical_cores: int


class MemoryInfo(BaseModel):
    total_bytes: int
    used_bytes: int
    available_bytes: int
    percent: float


class DiskInfo(BaseModel):
    partition: str
    mountpoint: str
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent: float


class LoadAvg(BaseModel):
    one_min: float
    five_min: float
    fifteen_min: float


class NetworkInfo(BaseModel):
    bytes_sent: int
    bytes_recv: int


class SummaryMetrics(BaseModel):
    hostname: str
    platform: str
    cpu: CPUInfo
    memory: MemoryInfo
    disks: list[DiskInfo]
    load_avg: Optional[LoadAvg] = None
    uptime_seconds: int
    uptime_human: str
    boot_time_iso: str
    network: Optional[NetworkInfo] = None
    collected_at: str


class ProcessInfo(BaseModel):
    pid: int
    name: str
    username: str = "?"
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_rss_bytes: int = 0
    status: str = "unknown"


class ProcessesResponse(BaseModel):
    limit: int
    checked: int
    sort_by: Literal["cpu", "memory", "name"]
    processes: list[ProcessInfo]
    collected_at: str
