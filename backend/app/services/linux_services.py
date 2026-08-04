"""Linux service discovery and status.

Resolution order:
1. systemd (only if PID 1 is really systemd; avoids the typical WSL error).
2. SysV via /etc/init.d.
3. If no manager is accessible, a controlled response with available=False.

`get_services_with_tracking` also resolves the status of configured
tracked services (nginx, docker, ...) including "not installed".
"""

import os
import shutil
import subprocess

from ..schemas.services import ServiceInfo, ServicesResponse, TrackedService

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
    """Checks whether PID 1 is systemd (avoids the typical WSL error)."""
    try:
        with open("/proc/1/comm", "r", encoding="utf-8") as proc:
            return proc.read().strip() == "systemd"
    except OSError:
        return False


def _safe_run(cmd: list[str]) -> tuple[int, str, str]:
    """Runs a command and returns (exit code, stdout, stderr) safely."""
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
    """Parses `systemctl list-units` output (no legend, no colors)."""
    services = []
    for raw in stdout.splitlines():
        line = raw.strip()
        if not line:
            continue
        # Columns: UNIT LOAD ACTIVE SUB DESCRIPTION
        parts = line.split(None, 4)
        parts += [""] * (5 - len(parts))
        unit, load, active, sub, description = parts[:5]
        if not unit.endswith(".service"):
            continue
        # systemd appends "..." when the description is truncated.
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
    """Lists /etc/init.d scripts (excluding README and hidden files)."""
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
    """Service status with controlled degradation."""
    # --- Preferred: systemd -------------------------------------------------
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
                    detail="systemctl responded but listed no services.",
                    services=[],
                    counts={},
                )

    # --- Fallback: SysV scripts --------------------------------------------
    sysv_services = _sysv_services()
    if sysv_services:
        return ServicesResponse(
            available=True,
            manager="sysv",
            detail="Gestor systemd no arrancado en este entorno; se listan scripts de /etc/init.d.",
            services=sysv_services,
            counts=_tally(sysv_services),
        )

    # --- No accessible manager: controlled response (never crashes) --------
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


def _build_tracked(services: list[ServiceInfo], names: list[str]) -> list[TrackedService]:
    by_name = {service.name: service for service in services}
    tracked = []
    for name in names:
        service = by_name.get(f"{name}.service")
        if service is None:
            tracked.append(
                TrackedService(name=name, state="not_found", label="No instalado", active_state=None)
            )
        elif service.active_state == "failed":
            tracked.append(
                TrackedService(name=name, state="failed", label="Fallido", active_state="failed")
            )
        else:
            tracked.append(
                TrackedService(
                    name=name,
                    state=service.active_state,
                    label=service.label,
                    active_state=service.active_state,
                )
            )
    return tracked


def get_services_with_tracking(tracked_names: list[str]) -> ServicesResponse:
    """Service status plus per-name status for configured tracked services."""
    response = get_services()
    response.tracked = _build_tracked(response.services, tracked_names)
    return response