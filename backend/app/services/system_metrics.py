"""System metrics collection with psutil.

All functions are defensive: if something fails (permissions, platform,
processes dying mid-read) they degrade gracefully instead of breaking the
endpoint. Each getter returns plain dicts that the collector wraps.
"""

import os
import platform
import socket
import time
from datetime import datetime, timezone
from typing import Optional

import psutil


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_hostname() -> str:
    try:
        return socket.gethostname()
    except OSError:
        return "unknown"


def get_platform() -> str:
    try:
        return platform.platform()
    except OSError:
        return "unknown"


def get_cpu_info() -> dict:
    """CPU usage and core counts.

    psutil returns 0.0 on the first call (calibration); a short interval
    yields a real reading with negligible latency.
    """
    return {
        "percent": psutil.cpu_percent(interval=0.2),
        "cores": psutil.cpu_count(logical=False) or 0,
        "logical_cores": psutil.cpu_count(logical=True) or 0,
    }


def get_memory_info() -> dict:
    vm = psutil.virtual_memory()
    return {
        "total_bytes": vm.total,
        "used_bytes": vm.used,
        "available_bytes": vm.available,
        "percent": vm.percent,
    }


def get_disks() -> list[dict]:
    """Usage of every mounted partition; unreadable ones are skipped."""
    disks = []
    for partition in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(partition.mountpoint)
        except (PermissionError, OSError):
            continue
        disks.append(
            {
                "partition": partition.device or "desconocido",
                "mountpoint": partition.mountpoint,
                "total_bytes": usage.total,
                "used_bytes": usage.used,
                "free_bytes": usage.free,
                "percent": usage.percent,
            }
        )
    if not disks:
        try:
            usage = psutil.disk_usage("/")
            disks.append(
                {
                    "partition": "/",
                    "mountpoint": "/",
                    "total_bytes": usage.total,
                    "used_bytes": usage.used,
                    "free_bytes": usage.free,
                    "percent": usage.percent,
                }
            )
        except (PermissionError, OSError):
            pass
    return disks


def get_load_avg() -> Optional[dict]:
    """Load average (1, 5 and 15 minutes). Linux/Unix only."""
    try:
        one, five, fifteen = os.getloadavg()
        return {"one_min": one, "five_min": five, "fifteen_min": fifteen}
    except (AttributeError, OSError):
        return None


def get_uptime() -> tuple[int, str, str]:
    """Returns (seconds, human readable, boot time ISO)."""
    boot_time = psutil.boot_time()
    seconds = max(0, int(time.time() - boot_time))
    boot_iso = datetime.fromtimestamp(boot_time, tz=timezone.utc).isoformat()
    return seconds, _humanize_uptime(seconds), boot_iso


def _humanize_uptime(seconds: int) -> str:
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    parts = []
    if days:
        parts.append(f"{days} {'día' if days == 1 else 'días'}")
    if hours:
        parts.append(f"{hours} {'hora' if hours == 1 else 'horas'}")
    if minutes:
        parts.append(f"{minutes} {'minuto' if minutes == 1 else 'minutos'}")
    if not parts:
        parts.append(f"{secs} segundos")
    return ", ".join(parts)


def get_network_info(previous=None, previous_ts: Optional[float] = None) -> Optional[dict]:
    """Cumulative counters plus transfer rates in bytes/second.

    Rates are computed from the delta between the previous and the current
    sample. Returns None on platforms without network counters.
    """
    try:
        io = psutil.net_io_counters()
    except (psutil.Error, OSError):
        return None
    now = time.monotonic()
    sent_bps = recv_bps = None
    if previous is not None and previous_ts is not None:
        elapsed = now - previous_ts
        if elapsed > 0:
            sent_bps = max(0, io.bytes_sent - previous.bytes_sent) / elapsed
            recv_bps = max(0, io.bytes_recv - previous.bytes_recv) / elapsed
    return {
        "bytes_sent": io.bytes_sent,
        "bytes_recv": io.bytes_recv,
        "sent_bps": round(sent_bps, 1) if sent_bps is not None else None,
        "recv_bps": round(recv_bps, 1) if recv_bps is not None else None,
        "state": (io, now),
    }


def get_processes(limit: int = 10, sort_by: str = "cpu") -> tuple[int, list[dict]]:
    """Top processes by CPU, memory or name.

    psutil needs two readings per process to compute CPU percentages; a
    short calibration pass (~0.1 s) provides real values.

    Returns (checked count, sorted and truncated processes).
    """
    processes: list[dict] = []
    try:
        procs = list(psutil.process_iter(["pid", "name", "username"]))
        for proc in procs:
            try:
                proc.cpu_percent(None)
            except psutil.Error:
                continue
        time.sleep(0.1)
        for proc in procs:
            try:
                info = proc.info
                processes.append(
                    {
                        "pid": info["pid"],
                        "name": info["name"] or "?",
                        "username": info["username"] or "?",
                        "cpu_percent": round(proc.cpu_percent(None), 1),
                        "memory_percent": round(proc.memory_percent(), 1),
                        "memory_rss_bytes": proc.memory_info().rss,
                        "status": proc.status(),
                    }
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
    except Exception:
        return 0, []

    checked = len(processes)
    if sort_by == "name":
        processes.sort(key=lambda p: p["name"].lower())
    else:
        key = "cpu_percent" if sort_by == "cpu" else "memory_percent"
        processes.sort(key=lambda p: p[key], reverse=True)
    return checked, processes[:limit]