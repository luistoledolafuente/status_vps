"""In-memory history store (ring buffer).

Designed to be swapped for SQLite/PostgreSQL later without changing the
route contract: the route only uses `record` and `points`.
"""

import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional


class HistoryStore:
    STORAGE_NAME = "memory"

    def __init__(self, max_points: int = 3600, snapshot_seconds: float = 15.0):
        self.max_points = max_points
        self.snapshot_seconds = snapshot_seconds
        self._points: deque[dict] = deque(maxlen=max_points)
        self._last_ts = 0.0

    def record(self, summary: dict) -> None:
        """Stores a snapshot of CPU/RAM/disk/network, throttled."""
        now = time.monotonic()
        if now - self._last_ts < self.snapshot_seconds:
            return
        self._last_ts = now
        disks = summary.get("disks") or []
        disk_max = max((disk.get("percent", 0) for disk in disks), default=0)
        network = summary.get("network") or {}
        self._points.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cpu_percent": round((summary.get("cpu") or {}).get("percent", 0), 1),
                "memory_percent": round((summary.get("memory") or {}).get("percent", 0), 1),
                "disk_percent": round(disk_max, 1),
                "sent_bps": network.get("sent_bps"),
                "recv_bps": network.get("recv_bps"),
            }
        )

    def points(self, since: Optional[str] = None, limit: int = 200) -> list[dict]:
        items = list(self._points)
        if since:
            try:
                cutoff = datetime.fromisoformat(since).replace(tzinfo=timezone.utc)
                items = [p for p in items if datetime.fromisoformat(p["timestamp"]) >= cutoff]
            except (ValueError, TypeError):
                pass
        return items[-limit:] if limit else items

    def clear(self) -> None:
        self._points.clear()