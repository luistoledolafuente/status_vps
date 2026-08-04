"""Metrics collector: orchestrates all metric sources.

Owns the network sample state (to compute transfer rates and monthly
accumulation), the anomaly score and the availability-check results, and
returns plain dicts compatible with the response schemas. Every source is
wrapped in a safe call so a single failing source never breaks an endpoint.
"""

from collections import deque
from datetime import datetime, timezone
from typing import Optional

from ..core.config import Settings
from ..schemas.services import ServicesResponse
from . import linux_services, system_metrics
from .anomaly import AnomalyScorer
from .checks import CheckService
from .history import HistoryStore
from .storage import TrafficTracker


class MetricsCollector:
    def __init__(
        self,
        settings: Settings,
        logger=None,
        history: Optional[HistoryStore] = None,
        traffic: Optional[TrafficTracker] = None,
        checks: Optional[CheckService] = None,
    ):
        self.settings = settings
        self.logger = logger
        self._prev_net = None
        self._prev_net_ts: Optional[float] = None
        self._errors: deque[str] = deque(maxlen=20)
        self.last_collection_at: Optional[str] = None
        self.history = history
        self.traffic = traffic or TrafficTracker()
        self.checks = checks
        self.anomaly_scorer = AnomalyScorer(
            window_minutes=settings.anomaly_window_minutes,
            critical=settings.anomaly_critical,
        )

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
            sent_delta = network.get("delta_sent", 0) or 0
            recv_delta = network.get("delta_recv", 0) or 0
            if sent_delta or recv_delta:
                self.traffic.add_delta(sent_delta, recv_delta)

        cpu = self._safe("cpu", system_metrics.get_cpu_info, {"percent": 0.0, "cores": 0, "logical_cores": 0})
        memory = self._safe(
            "memory", system_metrics.get_memory_info,
            {"total_bytes": 0, "used_bytes": 0, "available_bytes": 0, "percent": 0.0},
        )
        load_avg = self._safe("load_avg", system_metrics.get_load_avg, None)
        disks = self._safe("disks", system_metrics.get_disks, [])

        traffic = self._traffic_snapshot()
        anomaly = self._anomaly_snapshot(cpu, memory, load_avg)
        checks = self.checks.snapshot() if self.checks else []

        summary = {
            "hostname": system_metrics.get_hostname(),
            "platform": system_metrics.get_platform(),
            "cpu": cpu,
            "memory": memory,
            "disks": disks,
            "load_avg": load_avg,
            "uptime_seconds": uptime_seconds,
            "uptime_human": uptime_human,
            "boot_time_iso": boot_iso,
            "network": network,
            "traffic": traffic,
            "anomaly": anomaly,
            "checks": checks,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }
        self.last_collection_at = summary["collected_at"]
        return summary

    def _traffic_snapshot(self) -> dict:
        base = self.traffic.snapshot()
        quota_gb = self.settings.traffic_quota_gb
        if quota_gb and quota_gb > 0:
            quota_bytes = quota_gb * 1024**3
            base["quota_bytes"] = int(quota_bytes)
            base["percent"] = round(base["total_bytes"] / quota_bytes * 100, 1) if quota_bytes else None
        else:
            base["quota_bytes"] = None
            base["percent"] = None
        return base

    def _anomaly_snapshot(self, cpu: dict, memory: dict, load_avg: Optional[dict]) -> dict:
        try:
            points = self.history.recent(minutes=self.settings.anomaly_window_minutes) if self.history else []
            return self.anomaly_scorer.score(
                cpu_percent=cpu.get("percent", 0),
                memory_percent=memory.get("percent", 0),
                load_one_min=load_avg.get("one_min") if load_avg else None,
                history_points=points,
            )
        except Exception as exc:  # noqa: BLE001 - anomaly is a nice-to-have
            if self.logger:
                self.logger.warning("anomaly scoring failed", extra={"error": str(exc)})
            return {"score": 0.0, "level": "normal", "critical_threshold": self.settings.anomaly_critical, "metrics": {}}

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