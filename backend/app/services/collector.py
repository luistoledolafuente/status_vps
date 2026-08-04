"""Metrics collector: orchestrates all metric sources.

Owns the network sample state (to compute transfer rates), tracks recent
collector errors for observability, and returns plain dicts compatible
with the response schemas. Every source is wrapped in a safe call so a
single failing source never breaks an endpoint.
"""

from collections import deque
from datetime import datetime, timezone
from typing import Optional

from ..core.config import Settings
from ..schemas.services import ServicesResponse
from . import linux_services, system_metrics


class MetricsCollector:
    def __init__(self, settings: Settings, logger=None):
        self.settings = settings
        self.logger = logger
        self._prev_net = None
        self._prev_net_ts: Optional[float] = None
        self._errors: deque[str] = deque(maxlen=20)
        self.last_collection_at: Optional[str] = None

    # --- Safe wrapper --------------------------------------------------------

    def _safe(self, source: str, fn, default=None):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - collector must never crash
            message = f"{source}: {exc}"
            self._errors.append(message)
            if self.logger:
                self.logger.warning("collector source failed", extra={"error": str(exc), "source": source})
            return default

    def recent_errors(self, limit: int = 5) -> list[str]:
        return list(self._errors)[-limit:]

    def error_count(self) -> int:
        return len(self._errors)

    # --- Collection ------------------------------------------------------------

    def collect_summary(self) -> dict:
        uptime_seconds, uptime_human, boot_iso = system_metrics.get_uptime()
        network = self._safe(
            "network",
            lambda: system_metrics.get_network_info(self._prev_net, self._prev_net_ts),
            None,
        )
        if network:
            self._prev_net, self._prev_net_ts = network.pop("state")
        summary = {
            "hostname": system_metrics.get_hostname(),
            "platform": system_metrics.get_platform(),
            "cpu": self._safe("cpu", system_metrics.get_cpu_info, {"percent": 0.0, "cores": 0, "logical_cores": 0}),
            "memory": self._safe("memory", system_metrics.get_memory_info, {"total_bytes": 0, "used_bytes": 0, "available_bytes": 0, "percent": 0.0}),
            "disks": self._safe("disks", system_metrics.get_disks, []),
            "load_avg": self._safe("load_avg", system_metrics.get_load_avg, None),
            "uptime_seconds": uptime_seconds,
            "uptime_human": uptime_human,
            "boot_time_iso": boot_iso,
            "network": network,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }
        self.last_collection_at = summary["collected_at"]
        return summary

    def collect_processes(self, limit: int = 10, sort_by: str = "cpu") -> tuple[int, list[dict]]:
        return self._safe("processes", lambda: system_metrics.get_processes(limit, sort_by), (0, []))

    def collect_services(self) -> ServicesResponse:
        return self._safe(
            "services",
            lambda: linux_services.get_services_with_tracking(self.settings.tracked_services),
            ServicesResponse(
                available=False,
                manager=None,
                detail="El recolector de servicios falló; inténtalo de nuevo.",
                services=[],
                counts={},
            ),
        )