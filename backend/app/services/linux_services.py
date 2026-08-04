"""Detección y estado de servicios Linux.

Orden de resolución:
1. systemd (solo si de verdad es el init, evita el error típico de WSL).
2. SysV via /etc/init.d.
3. Si no hay gestor accesible, respuesta controlada con available=False.
"""

import os
import shutil
import subprocess

from ..schemas.services import ServiceInfo, ServicesResponse

_STATE_LABELS = {
    "active": "Activo",
    "inactive": "Inactivo",
    "failed": "Fallido",
    "activating": "Activando",
    "deactivating": "Desactivando",
    "exited": "Finalizado",
    "reloading": "Recargando",
    "registered": "Registrado",
}


def _translate(state: str) -> str:
    return _STATE_LABELS.get(state, state.title() if state else "Desconocido")


def _systemctl_available() -> bool:
    return shutil.which("systemctl") is not None


def _system_is_booted_with_systemd() -> bool:
    """Comprueba si PID 1 es systemd (evita el error típico de WSL sin systemd)."""
    try:
        with open("/proc/1/comm", "r", encoding="utf-8") as proc:
            return proc.read().strip() == "systemd"
    except OSError:
        return False


def _safe_run(cmd: list[str]) -> tuple[int, str, str]:
    """Ejecuta un comando y devuelve (código de salida, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=15,
            stdin=subprocess.DEVNULL,
        )
        return result.returncode, result.stdout, result.stderr
    except (subprocess.SubprocessError, OSError):
        return -1, "", "comando no disponible"


def _parse_systemctl_units(stdout: str) -> list[ServiceInfo]:
    """Interpreta la salida de `systemctl list-units`."""
    services = []
    for raw in stdout.splitlines():
        line = raw.strip()
        if not line:
            continue
        # Columnas: UNIT LOAD ACTIVE SUB DESCRIPTION
        parts = line.split(None, 4)
        parts += [""] * (5 - len(parts))
        unit, load, active, sub, description = parts[:5]
        if not unit.endswith(".service"):
            continue
        # Limpieza del marcador de truncado "..." que systemd pega al final.
        description = description.rstrip()
        if description.endswith("..."):
            description = description[:-3].rstrip()
        services.append(
            ServiceInfo(
                name=unit,
                description=description,
                load_state=load,
                active_state=active,
                sub_state=sub,
                label=_translate(active),
            )
        )
    return services


def _tally(services: list[ServiceInfo]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for service in services:
        state = service.active_state
        counts[state] = counts.get(state, 0) + 1
    return counts


def _sysv_services() -> list[ServiceInfo]:
    """Enumera scripts de /etc/init.d (excluye README y archivos ocultos)."""
    init_d = "/etc/init.d"
    if not os.path.isdir(init_d):
        return []
    try:
        names = sorted(os.listdir(init_d))
    except OSError:
        return []
    services = []
    for name in names:
        path = os.path.join(init_d, name)
        if name.startswith(".") or name == "README" or not os.path.isfile(path):
            continue
        services.append(
            ServiceInfo(
                name=name,
                description="Script de inicio SysV",
                load_state="registered",
                active_state="unknown",
                sub_state="unknown",
                label=_translate("registered"),
            )
        )
    return services


def get_services() -> ServicesResponse:
    """Estado de los servicios del sistema, con degradación controlada."""

    # ---- Preferencia 1: systemd -----------------------------------------
    if _systemctl_available():
        code, stdout, _stderr = _safe_run(
            [
                "systemctl",
                "list-units",
                "--type=service",
                "--all",
                "--no-pager",
                "--no-legend",
            ]
        )
        if code == 0:
            services = _parse_systemctl_units(stdout)
            if services:
                return ServicesResponse(
                    available=True,
                    manager="systemd",
                    detail="",
                    services=services,
                    counts=_tally(services),
                )
            if _system_is_booted_with_systemd():
                return ServicesResponse(
                    available=True,
                    manager="systemd",
                    detail="systemctl respondió pero no listó ningún servicio.",
                    services=[],
                    counts={},
                )

    # ---- Preferencia 2: scripts SysV ------------------------------------
    sysv_services = _sysv_services()
    if sysv_services:
        return ServicesResponse(
            available=True,
            manager="sysv",
            detail="Gestor systemd no arrancado en este entorno; se listan scripts de /etc/init.d.",
            services=sysv_services,
            counts=_tally(sysv_services),
        )

    # ---- Sin gestor accesible: respuesta controlada (no rompe la app) ----
    return ServicesResponse(
        available=False,
        manager=None,
        detail=(
            "No se encontró un gestor de servicios accesible en este entorno "
            "(por ejemplo, WSL sin systemd arrancado). Consulta el README para "
            "activar systemd en WSL."
        ),
        services=[],
        counts={},
    )
