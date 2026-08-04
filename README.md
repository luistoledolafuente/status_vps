# System Status — Monitor de servidores Linux

Panel web de monitoreo en tiempo real: CPU, RAM, disco, red, procesos, servicios (systemd) y alertas por umbrales. Backend FastAPI + WebSocket, frontend React.

---

## 1. Requisitos (WSL2 / Ubuntu)

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nodejs npm
node --version   # 18 o superior
```

> Si lo vas a probar en tu PC (no en un VPS), se recomienda hacerlo dentro de WSL2 con systemd activado (paso 4).

## 2. Arrancar el backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # opcional, solo si quieres ajustar configuración
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Comprueba que funciona: `curl http://localhost:8000/api/health` → `{"status":"ok",...}`. Swagger interactivo en `http://localhost:8000/docs`.

## 3. Arrancar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. Vite redirige `/api` y `/ws` al backend automáticamente, así que WebSocket y REST funcionan sin configuración extra.

## 4. Activar systemd en WSL2 (para ver servicios reales)

Por defecto WSL2 no arranca systemd, así que la pestaña **Servicios** mostrará avisos en vez de estados reales. Para activarlo:

```bash
sudo tee /etc/wsl.conf > /dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Reinicia WSL desde Windows (`wsl --shutdown`), abre la terminal de nuevo y reinicia backend y frontend.

## 5. Desplegar con Docker (servidor real)

```bash
cp backend/.env.example backend/.env   # ajusta los valores
docker compose up --build
```

- Frontend: `http://localhost:5173` (nginx sirve la SPA y proxya REST + WebSocket)
- Backend: `http://localhost:8000`

## 6. Cómo se usa el panel

- **Resumen**: KPIs en vivo (se actualizan solos cada 2 s por WebSocket), gráficas de tendencia, almacenamiento por partición y tráfico de red.
- **Procesos**: top por CPU o memoria, con buscador. Cambiar el orden recarga los datos.
- **Servicios**: chips de seguimiento de los servicios clave (nginx, docker, postgresql, redis, ssh, cron), listado completo con filtros por estado y buscador.
- **Alertas**: umbrales configurados, alertas activas y resueltas recientemente.

## 7. Configuración (opcional)

Archivo `backend/.env` (prefijo `SYSSTATUS_`). Las más útiles:

| Variable | Default | Descripción |
|---|---|---|
| `SYSSTATUS_TRACKED_SERVICES` | `nginx,docker,postgresql,redis,ssh,cron` | Servicios en seguimiento |
| `SYSSTATUS_ALERT_CPU_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de CPU (%) |
| `SYSSTATUS_ALERT_MEMORY_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de memoria (%) |
| `SYSSTATUS_ALERT_DISK_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de disco (%) |
| `SYSSTATUS_WS_INTERVAL_SECONDS` | `2` | Frecuencia del envío en vivo |
| `SYSSTATUS_AUTH_ENABLED` | `false` | Exige login (JWT) en la API |
| `SYSSTATUS_JWT_SECRET` | — | **Cambiarlo antes de activar auth** |
| `SYSSTATUS_ADMIN_PASSWORD` / `VIEWER_PASSWORD` | `admin123` / `viewer123` | Credenciales de los roles |

Con `SYSSTATUS_AUTH_ENABLED=true`, haz login en `POST /api/auth/token` (usuario/contraseña) y usa el token como `Authorization: Bearer <token>`.

## 8. Problemas comunes

| Problema | Solución |
|---|---|
| Página en blanco | Recarga con Ctrl+Shift+R (caché del navegador). |
| `python3: venv` no existe en WSL | `sudo apt install -y python3-venv` y recrea el `.venv` (`rm -rf .venv`). |
| Servicios muestran aviso "no disponible" | Activa systemd en WSL2 (paso 4) o usa un VPS Linux. |
| Docker aparece "Sin acceso" | Docker Desktop corre en Windows: activa la integración WSL (Settings → Resources → WSL integration) o instala docker en la distro. |
| El disco marca ~0% | Es correcto en WSL (el disco virtual es enorme y casi vacío); el KPI muestra la partición más usada y el espacio real usado/total. |
| No se conecta el WebSocket (dev) | El primer intento del navegador puede fallar al arrancar Vite; se reconecta solo. Verifica que el backend esté en el puerto 8000. |

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado + observabilidad (latencia, clientes WS) |
| GET | `/api/metrics/summary` | CPU, RAM, disco, red, uptime |
| GET | `/api/metrics/processes?limit=12&sort_by=cpu` | Procesos (`cpu` / `memory` / `name`) |
| GET | `/api/metrics/history?limit=200` | Histórico para las gráficas |
| GET | `/api/services` | Servicios + seguimiento |
| GET | `/api/alerts` | Alertas y umbrales |
| POST | `/api/auth/token` | Login JWT (opcional) |
| WS | `/ws/metrics` | Datos en vivo cada 2 s |
| GET | `/docs` | Swagger |
