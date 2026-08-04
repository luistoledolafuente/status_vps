"""History store: live ring buffer plus optional SQLite persistence.

Snapshots are kept in a small in-memory ring (fast reads for charts and
anomaly scoring) and written to SQLite when persistence is enabled, so the
history survives restarts. The route contract (`record` / `points`) is
unchanged.
"""

import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Optional

from .storage import SQLiteStore


class HistoryStore:
    def __init__(
        self,
        max_points: int = 3600,
        snapshot_seconds: float = 15.0,
        db_path: Optional[str] = None,
        retention_days: int = 30,
    ):
        self.max_points = max_points
        self.snapshot_seconds = snapshot_seconds
        self._points: deque[dict] = deque(maxlen=max_points)
        self._last_ts = 0.0
        self._store = SQLiteStore(db_path, retention_days) if db_path else None
        self.STORAGE_NAME = "sqlite" if self._store else "memory"
        self.sqlite_store = self._store

    def record(self, summary: dict) -> None:
        """Stores a snapshot of CPU/RAM/disk/network, throttled."""
        now = time.monotonic()
        if now - self._last_ts < self.snapshot_seconds:
            return
        self._last_ts = now
        disks = summary.get("disks") or []
        disk_max = max((disk.get("percent", 0) for disk in disks), default=0)
        network = summary.get("network") or {}
        point = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cpu_percent": round((summary.get("cpu") or {}).get("percent", 0), 1),
            "memory_percent": round((summary.get("memory") or {}).get("percent", 0), 1),
            "disk_percent": round(disk_max, 1),
            "sent_bps": network.get("sent_bps"),
            "recv_bps": network.get("recv_bps"),
        }
        self._points.append(point)
        if self._store is not None:
            self._store.record_metric(point)

    def points(self, since: Optional[str] = None, limit: int = 200) -> list[dict]:
        """Most recent points, in chronological order.

        Reads from the in-memory window; on a fresh start (after a restart)
        falls back to the persisted store so charts keep their history.
        """
        items = list(self._points)
        if not items and self._store is not None:
            items = self._store.read_metrics(since=since, limit=limit)
        if since:
            try:
                cutoff = datetime.fromisoformat(since).replace(tzinfo=timezone.utc)
                items = [p for p in items if datetime.fromisoformat(p["timestamp"]) >= cutoff]
            except (ValueError, TypeError):
                pass
        return items[-limit:] if limit else items

    def recent(self, minutes: int = 120, limit: int = 500) -> list[dict]:
        """Points from the last N minutes (used for anomaly scoring)."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        items = [
            p
            for p in self._points
            if datetime.fromisoformat(p["timestamp"]) >= cutoff
        ]
        return items[-limit:] if limit else items

    def clear(self) -> None:
        self._points.clear()
