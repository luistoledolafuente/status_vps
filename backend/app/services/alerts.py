"""Threshold-based alert service.

Evaluates CPU, memory, disk and tracked-service state on every collection
and keeps a small set of active alerts plus recently resolved ones.
Alerts are actionable (message + tip) and deduplicated to avoid noise.
"""

import itertools
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from ..core.config import Settings


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AlertService:
    MAX_RESOLVED = 20

    def __init__(self, settings: Settings, logger=None):
        self.settings = settings
        self.logger = logger
        self._active: dict[str, dict] = {}
        self._recent: deque[dict] = deque(maxlen=self.MAX_RESOLVED)
        self._seq = itertools.count(1)

    # --- Helpers -------------------------------------------------------------

    def _thresholds(self) -> dict:
        return {
            "cpu_warning": self.settings.alert_cpu_warning,
            "cpu_critical": self.settings.alert_cpu_critical,
            "memory_warning": self.settings.alert_memory_warning,
            "memory_critical": self.settings.alert_memory_critical,
            "disk_warning": self.settings.alert_disk_warning,
            "disk_critical": self.settings.alert_disk_critical,
        }

    def _upsert(
        self,
        key: str,
        severity: str,
        title: str,
        message: str,
        tip: str,
        metric: Optional[str],
        value: Optional[float],
        threshold: Optional[float],
    ) -> None:
        now = _now_iso()
        alert = self._active.get(key)
        if alert is not None:
            alert["last_seen"] = now
            if severity == "critical" and alert["severity"] != "critical":
                alert["severity"] = severity
                alert["message"] = message
                alert["value"] = value
                alert["threshold"] = threshold
            return
        self._active[key] = {
            "id": f"al-{next(self._seq)}",
            "key": key,
            "severity": severity,
            "title": title,
            "message": message,
            "tip": tip,
            "state": "active",
            "metric": metric,
            "value": value,
            "threshold": threshold,
            "first_seen": now,
            "last_seen": now,
            "resolved_at": None,
        }
        if self.logger:
            self.logger.warning("alert raised", extra={"event": key, "severity": severity})

    def _resolve(self, key: str) -> None:
        alert = self._active.pop(key, None)
        if alert is not None:
            alert["state"] = "resolved"
            alert["resolved_at"] = _now_iso()
            self._recent.appendleft(alert)
            if self.logger:
                self.logger.info("alert resolved", extra={"event": key})

    def _check_threshold(
        self,
        key: str,
        label: str,
        value: float,
        warning: float,
        critical: float,
        tip: str,
    ) -> None:
        metric = key.split("_")[0]
        if value >= critical:
            self._upsert(
                key, "critical", f"{label} crítica",
                f"El uso de {label.lower()} alcanzó {value:.0f}% (umbral crítico {critical:.0f}%).",
                tip, metric=metric, value=value, threshold=critical,
            )
        elif value >= warning:
            self._upsert(
                key, "warning", f"{label} alto",
                f"El uso de {label.lower()} está en {value:.0f}% (umbral de aviso {warning:.0f}%).",
                tip, metric=metric, value=value, threshold=warning,
            )
        else:
            self._resolve(key)

    # --- Public API -----------------------------------------------------------

    def evaluate(self, summary: Optional[dict] = None, services=None) -> list[dict]:
        """Evaluates alerts for the given summary and/or services payload."""
        if summary is not None:
            cpu = (summary.get("cpu") or {}).get("percent", 0)
            memory = (summary.get("memory") or {}).get("percent", 0)
            disks = summary.get("disks") or []
            disk = max(disks, key=lambda d: d.get("percent", 0), default=None)
            disk_percent = disk.get("percent", 0) if disk else 0

            self._check_threshold(
                "cpu_high", "CPU", cpu,
                self.settings.alert_cpu_warning, self.settings.alert_cpu_critical,
                "Revisa la vista de Procesos para identificar qué proceso consume más CPU.",
            )
            self._check_threshold(
                "memory_high", "Memoria", memory,
                self.settings.alert_memory_warning, self.settings.alert_memory_critical,
                "Considera liberar memoria o detener aplicaciones pesadas.",
            )
            mountpoint = disk.get("mountpoint", "/") if disk else "/"
            self._check_threshold(
                "disk_full", "Disco", disk_percent,
                self.settings.alert_disk_warning, self.settings.alert_disk_critical,
                f"Libera espacio en la partición {mountpoint} (archivos temporales, logs, paquetes sin usar).",
            )
        if services is not None:
            for item in getattr(services, "tracked", []):
                key = f"service_down_{item.name}"
                if item.state == "failed":
                    self._upsert(
                        key, "critical", f"Servicio {item.name} caído",
                        f"El servicio {item.name} está en estado fallido y no responde.",
                        f"Revisa los logs con: journalctl -u {item.name}.service",
                        metric="service", value=None, threshold=None,
                    )
                else:
                    self._resolve(key)
        return list(self._active.values())

    def snapshot(self) -> dict:
        active = sorted(self._active.values(), key=lambda a: a["last_seen"], reverse=True)
        recent = list(self._recent)
        return {
            "active_count": len(active),
            "thresholds": self._thresholds(),
            "alerts": active + recent,
        }