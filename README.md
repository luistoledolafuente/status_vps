# System Status — Monitor profesional de servidores Linux

Aplicación web de **observabilidad y monitoreo** de un servidor Linux en tiempo casi
real, pensada para usuarios técnicos y no técnicos. Muestra CPU, RAM, disco (por
partición), tráfico de red, uptime, carga del sistema, procesos más pesados, estado
de servicios (systemd/SysV) y **alertas por umbrales**.

Diseñada para practicar en **WSL2 (Ubuntu)** y migrarse después a un servidor Linux
real (Docker incluido).

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python + FastAPI + Uvicorn |
| Métricas | psutil |
| Tiempo real | WebSocket (`/ws/metrics`, cada 2 s) + REST |
| Frontend | React + Vite |
| Gráficas | Chart.js (react-chartjs-2) |
| Estilos | Tailwind CSS |
| Config | variables de entorno (pydantic-settings) |
| Seguridad | JWT opcional + roles admin/viewer + rate limiting preparado |
| Logs | JSON estructurado (stdout) |

---

## Funcionalidades

- **KPIs**: CPU, memoria, disco, tráfico de red y uptime, con color por severidad.
- **Gráficas**: evolución de CPU/memoria/disco, uso por partición y tasas de red.
- **Procesos**: top por CPU o memoria, búsqueda y paginación.
- **Servicios**: seguimiento de servicios clave (nginx, docker, postgresql, redis, ssh, cron)
  y listado completo con filtros por estado. Si systemctl no está disponible
  (WSL sin systemd), se devuelve una respuesta controlada, nunca un error.
- **Alertas**: CPU, memoria, disco y servicio caído, con umbrales configurables,
  mensaje accionable y sugerencia. Se auto-resuelven al normalizarse.
- **Histórico**: snapshots en memoria (CPU/RAM/disco/red) expuestos en
  `/api/metrics/history` para rellenar las gráficas.
- **Observabilidad interna**: tiempo de respuesta promedio, clientes WebSocket,
  errores del recolector y última recolección en `/api/health`.
- **En vivo por WebSocket**: KPIs y gráficas se actualizan vía un único
  WebSocket (`/ws/metrics`, cada 2 s) con reconexión automática e indicador de
  estado (conectado / reconectando / desconectado). No hay polling.
- **Datos secundarios bajo demanda (REST)**: procesos, servicios, alertas y
  salud se consultan al cargar la página y al cambiar de pestaña (o de
  ordenación), nunca en intervalos automáticos.

## Estructura del proyecto

```
system_status_vps/
├── backend/                          # API FastAPI
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                   # app, CORS, lifespan, broadcaster WS, middleware
│       ├── core/
│       │   ├── config.py             # Settings (pydantic-settings, prefijo SYSSTATUS_)
│       │   ├── logging.py            # logs JSON estructurados
│       │   └── security.py           # JWT (create/decode token)
│       ├── api/
│       │   ├── deps.py               # get_current_user, require_role, rate_limit, app state
│       │   └── routes/
│       │       ├── health.py         # /api/health + observabilidad
│       │       ├── metrics.py        # summary, processes, history
│       │       ├── services.py       # servicios + seguimiento
│       │       ├── alerts.py         # alertas y umbrales
│       │       ├── auth.py           # POST /api/auth/token (JWT)
│       │       └── websocket.py      # GET /ws/metrics
│       ├── schemas/                  # DTOs Pydantic
│       ├── services/                 # lógica de dominio
│       │   ├── collector.py          # orquesta fuentes + errores del recolector
│       │   ├── system_metrics.py     # psutil (CPU, RAM, disco, red con tasas)
│       │   ├── linux_services.py     # systemctl/SysV + servicios en seguimiento
│       │   ├── history.py            # histórico en memoria (sustituible por SQLite/PG)
│       │   └── alerts.py             # evaluador de umbrales + alertas activas
│       └── ws/
│           └── manager.py            # conexiones WebSocket y broadcast
├── frontend/                         # SPA React + Vite
│   ├── .env.example
│   ├── Dockerfile
│   ├── nginx.conf                    # proxy REST + WS en producción
│   └── src/
│       ├── config.js                 # API base y URL del WebSocket
│       ├── api/client.js             # capa única de REST
│       ├── hooks/
│       │   ├── useWebSocket.js       # conexión, reconexión con backoff, estado
│       │   └── useDashboardData.js   # orquesta WS + datos REST bajo demanda
│       ├── components/
│       │   ├── layout/AppHeader.jsx  # tabs + estado de la conexión WS
│       │   ├── ui/                   # Card, Badge, StatusDot, EmptyState, ErrorBanner, Skeleton
│       │   ├── KPIGrid.jsx, MetricCard.jsx, SystemCharts.jsx
│       │   ├── ProcessTable.jsx, ServiceStatusList.jsx, AlertList.jsx
│       └── pages/
│           ├── Dashboard.jsx         # resumen
│           ├── ProcessesPage.jsx
│           ├── ServicesPage.jsx
│           └── AlertsPage.jsx
├── docker-compose.yml
└── README.md
```

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado + observabilidad interna (latencia, WS, errores) |
| GET | `/api/metrics/summary` | CPU, RAM, disco por partición, red, uptime, carga |
| GET | `/api/metrics/processes?limit=12&sort_by=cpu` | Procesos (`cpu` / `memory` / `name`) |
| GET | `/api/metrics/history?limit=200&since=ISO` | Histórico de snapshots |
| GET | `/api/services` | Servicios completos + seguimiento (estado controlado si no hay systemd) |
| GET | `/api/alerts` | Alertas activas/resueltas + umbrales |
| POST | `/api/auth/token` | JWT (admin/viewer, opcional) |
| WS | `/ws/metrics` | Stream en vivo cada 2 s (`{"type":"metrics","data":{...}}`) |
| GET | `/docs` | Swagger interactivo |

## Ejecución en WSL2 (Ubuntu)

### 1. Requisitos

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nodejs npm
node --version   # 18 o superior
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Opcional: crear .env desde la plantilla
cp .env.example .env

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Prueba: `curl http://localhost:8000/api/health` · Swagger en `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Vite redirige `/api` y `/ws` al backend, así que
WebSocket y REST funcionan sin configuración adicional.

### 4. Servicios reales en WSL (opcional)

WSL2 no arranca systemd por defecto; `/api/services` responderá con
`available:false` (comportamiento controlado). Para ver estados reales:

```bash
sudo tee /etc/wsl.conf > /dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Reinicia WSL desde Windows (`wsl --shutdown`), vuelve a abrir, y reinicia ambos
servidores.

## Docker (servidor real)

```bash
cp backend/.env.example backend/.env   # ajusta los valores
docker compose up --build
```

- Frontend: `http://localhost:5173` (nginx sirve la SPA y proxya REST + WS).
- Backend: `http://localhost:8000`.

---

## Configuración (variables de entorno)

Prefijo `SYSSTATUS_`, archivo `backend/.env` (ver `.env.example`). Las más relevantes:

| Variable | Default | Descripción |
|---|---|---|
| `SYSSTATUS_CORS_ORIGINS` | `http://localhost:5173,...` | Orígenes permitidos (coma) |
| `SYSSTATUS_AUTH_ENABLED` | `false` | Activa verificación JWT en todos los endpoints |
| `SYSSTATUS_JWT_SECRET` | — | **Obligatorio cambiarlo en producción** |
| `SYSSTATUS_ADMIN_PASSWORD` / `VIEWER_PASSWORD` | admin123/viewer123 | Credenciales de los roles |
| `SYSSTATUS_WS_INTERVAL_SECONDS` | `2` | Frecuencia del broadcast WebSocket |
| `SYSSTATUS_HISTORY_SNAPSHOT_SECONDS` | `15` | Cada cuánto se guarda un snapshot |
| `SYSSTATUS_ALERT_CPU_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales CPU |
| `SYSSTATUS_ALERT_MEMORY_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales memoria |
| `SYSSTATUS_ALERT_DISK_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales disco |
| `SYSSTATUS_TRACKED_SERVICES` | `nginx,docker,postgresql,redis,ssh,cron` | Servicios en seguimiento |
| `SYSSTATUS_RATE_LIMIT_ENABLED` / `_PER_MINUTE` | `false` / `120` | Límite por IP (preparado) |
| `SYSSTATUS_LOG_LEVEL` | `INFO` | Nivel de logs JSON |

## Seguridad (preparada desde el inicio)

- **JWT opcional**: con `SYSSTATUS_AUTH_ENABLED=true` todos los endpoints REST
  exigen `Authorization: Bearer <token>` (obtenido en `/api/auth/token`).
- **Roles**: `admin` y `viewer`; la dependencia `require_role` está lista para
  proteger rutas de escritura/administración.
- **Rate limiting**: limitador por IP incluido (desactivado por defecto), pensado
  para activarse detrás de un proxy en producción.
- **Validación**: Pydantic en todas las respuestas y parámetros (límites en
  queries, enumerados en `sort_by`, etc.).
- **WebSocket**: solo lectura y con volumen controlado; no acepta comandos.
- Recomendaciones OWASP aplicadas: secretos por entorno (nunca en código),
  contraseñas con comparación en tiempo constante, errores 401/403 explícitos.

> Antes de exponerlo a Internet: HTTPS (proxy inverso), cambiar `JWT_SECRET` y
> contraseñas, habilitar auth, y considerar rate limiting + firewall.

## WebSocket primero — decisión de arquitectura

El frontend consume **únicamente WebSocket** para los datos en vivo. No existe
modo polling ni fallback: si el WebSocket se cae, se reconecta con backoff
exponencial (1 s → 10 s máx) y la UI muestra el estado de la conexión. El
resumen (KPIs + gráficas) llega por push cada 2 s.

Los datos secundarios (procesos, servicios, alertas, salud) se obtienen por
REST **bajo demanda**: al cargar la página y al cambiar de pestaña u
ordenación. Esto mantiene la carga del servidor baja y evita el desperdicio de
peticiones periódicas, conservando la robustez de HTTP para datos gruesos.

**Por qué WebSocket y no polling:**

| Criterio | Polling (REST) | WebSocket |
|---|---|---|
| Latencia | Depende del intervalo (2 s mínimo razonable) | Push inmediato (máximo ~2 s en este diseño) |
| Carga de red | N cabeceras HTTP por tick y por cliente (overhead por petición) | 1 conexión persistente, frames ligeros; menor overhead total |
| Carga del servidor | Coste fijo por petición; crece linealmente con los clientes | Coste por conexión + broadcast; escala bien con pocos clientes |
| Fiabilidad | Se auto-recupera (cada petición es independiente) | Requiere lógica de reconexión (implementada con backoff) |
| Backpressure | El cliente se auto-regula (intervalo) | El servidor debe manejar clientes lentos (broadcast con try/except) |
| Caché/proxies | Compatible con HTTP cache | No aplica |

El histórico (`REST /history`) se consulta al cargar la página para rellenar
las gráficas con el pasado reciente (snapshots del servidor, no solo lo visto
en la sesión). Si algún día hay decenas de clientes, el broadcast no recoge
métricas por cliente (una sola recolección compartida), por lo que el coste
marginal por conexión es mínimo.

## Decisiones técnicas

- **Recolector único compartido**: el broadcast WS y los endpoints REST usan la
  misma instancia (`MetricsCollector`), con muestra de red compartida para
  calcular tasas y caché de errores para observabilidad.
- **Histórico en memoria (ring buffer)**: suficiente para el MVP; la interfaz
  (`record`/`points`) está aislada en `HistoryStore` para migrar a SQLite/PostgreSQL
  sin tocar rutas ni frontend.
- **Alertas sin ruido**: solo transiciones (alta/resuelta), deduplicación por clave
  y reescalado warning→critical sin duplicar.
- **systemd con verificación real**: no basta con que exista `systemctl`; se
  comprueba que PID 1 sea systemd para no caer en el error típico de WSL.
- **Logs JSON**: listos para journald/Loki; incluyen método, ruta, status y
  duración por petición.
- **Cero dependencias superfluas**: React Router no hace falta (navegación por
  pestañas), el rate limiter es ~30 líneas y el auth usa PyJWT puro.

## Limitaciones del MVP profesional

- Histórico y alertas viven en memoria (se pierden al reiniciar; el endpoint de
  history documenta el contrato para la futura BD).
- Autenticación JWT existe pero desactivada por defecto; no hay gestión de
  usuarios persistente (solo admin/viewer por entorno).
- Las alertas no notifican (sin email/telegram); solo se ven en la UI.
- El WebSocket no autentica aún (solo lectura; añadir token en el handshake si
  se habilita auth en producción).

## Hoja de ruta

- [ ] Persistencia SQLite/PostgreSQL para histórico y alertas (interfaz ya aislada).
- [ ] Notificaciones (email/Telegram/Webhooks) con silenciamiento.
- [ ] JWT en el handshake del WebSocket + refresh tokens.
- [ ] Múltiples servidores (agente remoto o lista de hosts en la UI).
- [ ] Exportación de métricas (CSV/Prometheus).
