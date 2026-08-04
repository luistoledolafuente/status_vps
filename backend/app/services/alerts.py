"""Threshold-based alert service.

Evaluates CPU, memory, disk, monthly traffic, availability checks, service
state and the anomaly score on every collection. Alerts fire only after a
threshold stays breached for `alert_sustain_seconds` (no false alarms on
momentary spikes), are deduplicated and can be pushed to a webhook.
"""

import itertools
import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from ..core.config import Settings
from .notifications import WebhookNotifier


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AlertService:
    MAX_RESOLVED = 20

    def __init__(self, settings: Settings, logger=None, notifier: Optional[WebhookNotifier] = None):
        self.settings = settings
        self.logger = logger
        self.notifier = notifier
        self._active: dict[str, dict] = {}
        self._recent: deque[dict] = deque(maxlen=self.MAX_RESOLVED)
        self._pending: dict[str, dict] = {}
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
            "traffic_warning": self.settings.traffic_warning_percent,
            "traffic_critical": self.settings.traffic_critical_percent,
            "anomaly_critical": self.settings.anomaly_critical,
        }

    def _notify(self, alert: dict) -> None:
        if self.notifier is not None and self.notifier.enabled:
            try:
                self.notifier.send(
                    {
                        "event": "alert_raised" if alert["state"] == "active" else "alert_resolved",
                        "severity": alert.get("severity"),
                        "title": alert.get("title"),
                        "message": alert.get("message"),
                        "tip": alert.get("tip"),
                        "metric": alert.get("metric"),
                        "value": alert.get("value"),
                        "threshold": alert.get("threshold"),
                    }
                )
            except Exception:  # noqa: BLE001 - notifications never crash alerting
                if self.logger:
                    self.logger.exception("notification failed")

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
                self._notify(alert)
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
        self._notify(self._active[key])

    def _resolve(self, key: str) -> None:
        alert = self._active.pop(key, None)
        if alert is not None:
            alert["state"] = "resolved"
            alert["resolved_at"] = _now_iso()
            self._recent.appendleft(alert)
            if self.logger:
                self.logger.info("alert resolved", extra={"event": key})
            self._notify(alert)

    def _check_threshold(
        self,
        key: str,
        label: str,
        value: float,
        warning: float,
        critical: float,
        tip: str,
        sustain: bool = True,
    ) -> None:
        """Raises an alert when the value stays above the threshold for the
        configured duration; resolves it once the value drops below warning."""
        metric = key.split("_")[0]
        if value >= warning:
            severity = "critical" if value >= critical else "warning"
            pending = self._pending.get(key)
            if pending is None:
                self._pending[key] = {"since": time.monotonic(), "severity": severity}
            elif severity == "critical" and pending["severity"] != "critical":
                self._pending[key] = {"since": time.monotonic(), "severity": "critical"}
            else:
                pending["severity"] = severity
            sustained = not sustain or time.monotonic() - self._pending[key]["since"] >= self.settings.alert_sustain_seconds
            if sustained and key not in self._active:
                self._upsert(
                    key, severity, f"{label} {'crítico' if severity == 'critical' else 'alto'}",
                    (
                        f"El uso de {label.lower()} alcanzó {value:.0f}% (umbral crítico {critical:.0f}%)."
                        if severity == "critical"
                        else f"El uso de {label.lower()} está en {value:.0f}% (umbral de aviso {warning:.0f}%)."
                    ),
                    tip, metric=metric, value=value, threshold=critical if severity == "critical" else warning,
                )
            return
        self._pending.pop(key, None)
        self._resolve(key)

    # --- Public API -----------------------------------------------------------

    def evaluate(
        self,
        summary: Optional[dict] = None,
        services=None,
        checks: Optional[list[dict]] = None,
    ) -> list[dict]:
        """Evaluates alerts for the given summary, services and/or checks."""
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

            traffic = summary.get("traffic")
            if traffic and traffic.get("percent") is not None:
                self._check_threshold(
                    "traffic_quota", "Tráfico mensual", traffic["percent"],
                    self.settings.traffic_warning_percent, self.settings.traffic_critical_percent,
                    "Consulta el uso por servicio o revisa backups y transferencias programadas.",
                )

            anomaly = summary.get("anomaly")
            if anomaly:
                score = anomaly.get("score", 0)
                self._check_threshold(
                    "anomaly_behavior", "Comportamiento del sistema", score,
                    self.settings.anomaly_critical, self.settings.anomaly_critical,
                    "Revisa los procesos y el tráfico reciente: algo se desvía del comportamiento habitual.",
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

        if checks is not None:
            for check in checks:
                key = f"check_down_{check['name']}"
                if check.get("state") == "down":
                    self._upsert(
                        key, "critical", f"Verificación {check['name']} sin respuesta",
                        f"El objetivo {check['target']} no responde ({check.get('error') or 'error de conexión'}).",
                        "Comprueba el proceso, el puerto y el firewall del objetivo.",
                        metric="check", value=None, threshold=None,
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
