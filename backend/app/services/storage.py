"""SQLite persistence: metric snapshots and monthly traffic counters.

Uses only the standard library (`sqlite3`). Writes are serialized with a
lock so concurrent collectors/routes never corrupt the database; WAL mode
keeps reads fast while the write happens.
"""

import os
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SQLiteStore:
    def __init__(self, db_path: str, retention_days: int = 30):
        self.db_path = db_path
        self.retention_days = retention_days
        self._lock = threading.Lock()
        directory = os.path.dirname(os.path.abspath(db_path))
        os.makedirs(directory, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS metrics (
                    timestamp      TEXT PRIMARY KEY,
                    cpu_percent    REAL,
                    memory_percent REAL,
                    disk_percent   REAL,
                    sent_bps       REAL,
                    recv_bps       REAL
                );
                CREATE TABLE IF NOT EXISTS traffic_month (
                    month       TEXT PRIMARY KEY,
                    sent_bytes  INTEGER NOT NULL DEFAULT 0,
                    recv_bytes  INTEGER NOT NULL DEFAULT 0,
                    updated_at  TEXT
                );
                """
            )
        self.prune()

    # --- Metric history ------------------------------------------------------

    def record_metric(self, point: dict) -> None:
        try:
            with self._lock, self._connect() as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO metrics VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        point["timestamp"],
                        point["cpu_percent"],
                        point["memory_percent"],
                        point["disk_percent"],
                        point.get("sent_bps"),
                        point.get("recv_bps"),
                    ),
                )
        except sqlite3.Error:
            pass  # persistence is best-effort; never break collection

    def read_metrics(self, since: Optional[str] = None, limit: int = 200) -> list[dict]:
        try:
            with self._lock, self._connect() as conn:
                query = "SELECT timestamp, cpu_percent, memory_percent, disk_percent, sent_bps, recv_bps FROM metrics"
                params: tuple = ()
                if since:
                    query += " WHERE timestamp >= ?"
                    params = (since,)
                query += " ORDER BY timestamp DESC LIMIT ?"
                rows = conn.execute(query, params + (limit,)).fetchall()
        except sqlite3.Error:
            return []
        points = [
            {
                "timestamp": row[0],
                "cpu_percent": row[1],
                "memory_percent": row[2],
                "disk_percent": row[3],
                "sent_bps": row[4],
                "recv_bps": row[5],
            }
            for row in rows
        ]
        points.reverse()
        return points

    def prune(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.retention_days)
        try:
            with self._lock, self._connect() as conn:
                conn.execute("DELETE FROM metrics WHERE timestamp < ?", (cutoff.isoformat(),))
        except sqlite3.Error:
            pass

    # --- Monthly traffic ------------------------------------------------------

    def get_month_traffic(self, month: str) -> dict:
        try:
            with self._lock, self._connect() as conn:
                row = conn.execute(
                    "SELECT sent_bytes, recv_bytes FROM traffic_month WHERE month = ?",
                    (month,),
                ).fetchone()
        except sqlite3.Error:
            return {"sent_bytes": 0, "recv_bytes": 0}
        if row is None:
            return {"sent_bytes": 0, "recv_bytes": 0}
        return {"sent_bytes": row[0], "recv_bytes": row[1]}

    def add_traffic_delta(self, month: str, sent_delta: int, recv_delta: int) -> dict:
        """Adds transfer deltas for a month and returns the new totals."""
        try:
            with self._lock, self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO traffic_month (month, sent_bytes, recv_bytes, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(month) DO UPDATE SET
                        sent_bytes = sent_bytes + ?,
                        recv_bytes = recv_bytes + ?,
                        updated_at = ?
                    """,
                    (month, sent_delta, recv_delta, _now_iso(), sent_delta, recv_delta, _now_iso()),
                )
                row = conn.execute(
                    "SELECT sent_bytes, recv_bytes FROM traffic_month WHERE month = ?",
                    (month,),
                ).fetchone()
                if row is None:
                    return {"sent_bytes": sent_delta, "recv_bytes": recv_delta}
                return {"sent_bytes": row[0], "recv_bytes": row[1]}
        except sqlite3.Error:
            return self.get_month_traffic(month)


class TrafficTracker:
    """Monthly transfer counters with SQLite persistence.

    Deltas are accumulated per calendar month so reboots (which reset the
    kernel counters) never lose usage already measured.
    """

    def __init__(self, store: Optional[SQLiteStore] = None):
        self._store = store
        self._memory: dict[str, dict] = {}

    def _month_key(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m")

    def _current(self, month: str) -> dict:
        if month in self._memory:
            return self._memory[month]
        if self._store is not None:
            try:
                stored = self._store.get_month_traffic(month)
                self._memory[month] = stored
                return stored
            except Exception:  # noqa: BLE001 - degrade to in-memory counters
                pass
        self._memory[month] = {"sent_bytes": 0, "recv_bytes": 0}
        return self._memory[month]

    def add_delta(self, sent_delta: int, recv_delta: int) -> dict:
        """Adds a transfer delta (bytes) and returns the updated totals."""
        month = self._month_key()
        current = self._current(month)
        sent = current["sent_bytes"] + max(0, sent_delta)
        recv = current["recv_bytes"] + max(0, recv_delta)
        self._memory[month] = {"sent_bytes": sent, "recv_bytes": recv}
        if self._store is not None:
            try:
                persisted = self._store.add_traffic_delta(month, max(0, sent_delta), max(0, recv_delta))
                self._memory[month] = persisted
                return persisted
            except Exception:  # noqa: BLE001 - keep in-memory totals on DB failure
                pass
        return self._memory[month]

    def snapshot(self) -> dict:
        month = self._month_key()
        totals = self._current(month)
        return {
            "month": month,
            "sent_bytes": totals["sent_bytes"],
            "recv_bytes": totals["recv_bytes"],
            "total_bytes": totals["sent_bytes"] + totals["recv_bytes"],
        }
