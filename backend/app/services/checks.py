"""Availability checks: HTTP(S) and TCP probes with latency measurement.

Runs the configured checks (`SYSSTATUS_CHECKS`) on a fixed interval and
keeps the latest result per check. A check flips to "down" only after two
consecutive failures, so a single dropped packet never causes a false
alert.
"""

import asyncio
import logging
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from ..core.config import Settings

_FAILURES_TO_DOWN = 2
_PROBE_TIMEOUT = 5.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CheckService:
    def __init__(self, settings: Settings, logger=None):
        self._checks = settings.checks
        self._interval = settings.checks_interval_seconds
        self._logger = logger or logging.getLogger("app.checks")
        self._last_run = 0.0
        self._failures: dict[str, int] = defaultdict(int)
        self._results: dict[str, dict] = {
            name: {
                "name": name,
                "target": target,
                "state": "unknown",
                "latency_ms": None,
                "checked_at": None,
                "error": None,
            }
            for name, target in self._checks
        }

    # --- Probing --------------------------------------------------------------

    async def _probe_http(self, url: str) -> tuple[float, Optional[str]]:
        def _request() -> float:
            start = time.perf_counter()
            with urllib.request.urlopen(url, timeout=_PROBE_TIMEOUT) as response:
                status = response.status
            if not (200 <= status < 400):
                raise ValueError(f"HTTP {status}")
            return (time.perf_counter() - start) * 1000

        return await asyncio.to_thread(_request)

    async def _probe_tcp(self, target: str) -> tuple[float, Optional[str]]:
        host, _, port = target.partition(":")
        if not host or not port:
            raise ValueError("destino TCP inválido (usa tcp://host:puerto)")
        start = time.perf_counter()
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, int(port)),
            timeout=_PROBE_TIMEOUT,
        )
        writer.close()
        try:
            await writer.wait_closed()
        except (OSError, RuntimeError):
            pass
        return (time.perf_counter() - start) * 1000

    async def _probe(self, name: str, target: str) -> dict:
        try:
            if target.startswith(("http://", "https://")):
                latency, error = await self._probe_http(target)
            elif target.startswith("tcp://"):
                latency, error = await self._probe_tcp(target.removeprefix("tcp://"))
            else:
                raise ValueError("esquema no soportado (usa http://, https:// o tcp://)")
            return {"name": name, "latency_ms": round(latency, 1), "error": error}
        except Exception as exc:  # noqa: BLE001 - any probe failure is a "down" signal
            return {"name": name, "latency_ms": None, "error": str(exc)}

    async def run_if_due(self) -> None:
        if not self._checks:
            return
        now = time.monotonic()
        if now - self._last_run < self._interval:
            return
        await self.run_once()

    async def run_once(self) -> None:
        self._last_run = time.monotonic()
        results = await asyncio.gather(
            *[self._probe(name, target) for name, target in self._checks]
        )
        for probe in results:
            name = probe["name"]
            if probe["error"] is None:
                self._failures[name] = 0
                self._results[name].update(
                    {
                        "state": "up",
                        "latency_ms": probe["latency_ms"],
                        "checked_at": _now_iso(),
                        "error": None,
                    }
                )
            else:
                self._failures[name] += 1
                down = self._failures[name] >= _FAILURES_TO_DOWN
                self._results[name].update(
                    {
                        "state": "down" if down else self._results[name]["state"],
                        "latency_ms": None,
                        "checked_at": _now_iso(),
                        "error": probe["error"],
                    }
                )
                self._logger.warning(
                    "check failed",
                    extra={"check": name, "failures": self._failures[name], "error": probe["error"]},
                )

    # --- Snapshot --------------------------------------------------------------

    def snapshot(self) -> list[dict]:
        return list(self._results.values())

    def enabled(self) -> bool:
        return bool(self._checks)
