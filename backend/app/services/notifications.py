"""Webhook notifications: posts alert events to an external endpoint.

The webhook is generic: any service that accepts a JSON POST works
(Telegram bots, Discord/Slack webhooks, ntfy, custom endpoints). The
payload is kept small and structured so each receiver can format it.
"""

import json
import logging
import urllib.request
from datetime import datetime, timezone
from typing import Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class WebhookNotifier:
    def __init__(
        self,
        url: str = "",
        timeout_seconds: int = 10,
        hostname: str = "",
        logger=None,
    ):
        self.url = url.strip()
        self.timeout = timeout_seconds
        self.hostname = hostname
        self._logger = logger or logging.getLogger("app.notifications")

    @property
    def enabled(self) -> bool:
        return bool(self.url)

    def send(self, event: dict) -> bool:
        """Posts an alert event (sync; callers should run it in a thread)."""
        if not self.enabled:
            return False
        payload = {
            "event": event.get("event"),
            "severity": event.get("severity"),
            "title": event.get("title"),
            "message": event.get("message"),
            "tip": event.get("tip"),
            "metric": event.get("metric"),
            "value": event.get("value"),
            "threshold": event.get("threshold"),
            "hostname": self.hostname,
            "timestamp": _now_iso(),
        }
        request = urllib.request.Request(
            self.url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                status = response.status
            self._logger.info(
                "webhook sent",
                extra={"event": event.get("event"), "status": status},
            )
            return True
        except Exception as exc:  # noqa: BLE001 - a failing webhook never crashes the app
            self._logger.warning(
                "webhook delivery failed",
                extra={"event": event.get("event"), "error": str(exc)},
            )
            return False

    def send_test(self) -> bool:
        """Sends a sample alert to verify the integration end to end."""
        return self.send(
            {
                "event": "alert_raised",
                "severity": "warning",
                "title": "Notificación de prueba",
                "message": "Esta es una notificación de prueba del panel de monitoreo.",
                "tip": "Si recibiste este mensaje, el webhook está configurado correctamente.",
                "metric": None,
                "value": None,
                "threshold": None,
            }
        )
