"""Recolección de métricas del sistema con psutil.

Todas las funciones son defensivas: si algo falla (permisos, plataforma,
procesos que mueren a mitad de lectura) se degrada de forma controlada en
lugar de romper el endpoint.
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


def _hostname() -> str:
    try:
        return socket.gethostname()
    except OSError:
        return "unknown"


def get_cpu_info() -> dict:
    """Uso de CPU y número de núcleos.

    psutil devuelve 0.0 en la primera llamada de calibración; con un
    intervalo corto obtenemos una lectura real sin penalizar la latencia.
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
    """Uso de cada partición montada; omite las que no se pueden leer."""
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
    # Respaldo: si no hay particiones legibles, al menos la raíz.
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
    """Carga del sistema (1, 5 y 15 minutos). Solo disponible en Linux/Unix."""
    try:
        one, five, fifteen = os.getloadavg()
        return {"one_min": one, "five_min": five, "fifteen_min": fifteen}
    except (AttributeError, OSError):
        return None


def get_uptime() -> tuple[int, str, str]:
    """Segundos, texto legible e ISO de la fecha de arranque."""
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


def get_network_info() -> Optional[dict]:
    """Contadores acumulados de red desde el arranque (MVP: sin tasas)."""
    try:
        io = psutil.net_io_counters()
        return {"bytes_sent": io.bytes_sent, "bytes_recv": io.bytes_recv}
    except (psutil.Error, OSError):
        return None


def get_summary() -> dict:
    uptime_seconds, uptime_human, boot_iso = get_uptime()
    return {
        "hostname": _hostname(),
        "platform": platform.platform(),
        "cpu": get_cpu_info(),
        "memory": get_memory_info(),
        "disks": get_disks(),
        "load_avg": get_load_avg(),
        "uptime_seconds": uptime_seconds,
        "uptime_human": uptime_human,
        "boot_time_iso": boot_iso,
        "network": get_network_info(),
        "collected_at": _now_iso(),
    }


def get_processes(limit: int = 10, sort_by: str = "cpu") -> tuple[int, list[dict]]:
    """Top de procesos según CPU o memoria.

    El porcentaje de CPU de psutil necesita dos lecturas; se hace una
    pasada de calibración con una pequeña pausa (~0.1 s) para obtener
    valores reales. Es un costo aceptable para un MVP.

    Devuelve (cantidad examinada, procesos ordenados y recortados).
    """
    processes: list[dict] = []
    try:
        procs = list(psutil.process_iter(["pid", "name", "username"]))
        # Primera pasada: calibración de cpu_percent por proceso.
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
                # Proceso terminó o no tenemos permisos: se omite.
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
