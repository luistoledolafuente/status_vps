# System Status — Monitor de recursos del servidor

Aplicación web de **observabilidad y monitoreo** de un servidor Linux, pensada para
usuarios técnicos y también para personas sin conocimientos técnicos. Muestra de forma
clara el uso de **CPU, memoria RAM, disco, red, uptime, carga del sistema, procesos
más pesados y el estado de los servicios Linux**.

Diseñada para ejecutarse **en WSL2 (Ubuntu)** como entorno de práctica y lista para
**migrarse a un servidor Linux real**.

---

## Stack

| Componente | Tecnología |
|---|---|
| Backend | Python + FastAPI + Uvicorn |
| Métricas | psutil |
| Frontend | React + Vite |
| Gráficas | Chart.js / react-chartjs-2 |
| Estilos | Tailwind CSS |
| Comunicación | REST API (con CORS + proxy en desarrollo) |

## Estructura del proyecto

```
system_status_vps/
├── backend/                 # API FastAPI
│   ├── app/
│   │   ├── main.py          # Punto de entrada y montaje de la app
│   │   ├── core/
│   │   │   └── config.py    # Configuración vía variables de entorno
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py
│   │   │       ├── metrics.py
│   │   │       └── services.py
│   │   ├── schemas/         # DTOs (Pydantic)
│   │   │   ├── metrics.py
│   │   │   └── services.py
│   │   └── services/        # Lógica de dominio
│   │       ├── system_metrics.py
│   │       └── linux_services.py
│   └── requirements.txt
├── frontend/                # SPA React con Vite
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js       # Proxy /api -> backend en desarrollo
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── api/client.js
│       ├── utils/format.js
│       ├── hooks/useDashboardData.js
│       ├── components/
│       │   ├── KPIGrid.jsx
│       │   ├── MetricCard.jsx
│       │   ├── SystemCharts.jsx
│       │   ├── ProcessTable.jsx
│       │   └── ServiceStatusList.jsx
│       └── pages/Dashboard.jsx
└── README.md
```

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado de la API |
| GET | `/api/metrics/summary` | CPU, RAM, disco, red, uptime y carga |
| GET | `/api/metrics/processes?limit=10&sort_by=cpu` | Procesos más pesados (`cpu` o `memory`) |
| GET | `/api/services` | Estado de servicios Linux (systemd/SysV) |
| GET | `/docs` | Documentación interactiva (Swagger) |

---

## Puesta en marcha en WSL2 (Ubuntu)

### 1. Requisitos previos

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nodejs npm
node --version   # debe ser 18 o superior
python3 --version
```

### 2. Backend

```bash
cd backend

# Crear y activar el entorno virtual
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Arrancar el servidor de desarrollo
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Prueba rápida:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/metrics/summary
```

La documentación interactiva queda en <http://localhost:8000/docs>.

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Arrancar el servidor de desarrollo de Vite
npm run dev
```

Abre <http://localhost:5173> desde el navegador de Windows o de Linux.
Vite usa un **proxy** (`/api` → `http://localhost:8000`) para que no haya
problemas de CORS en desarrollo.

> Si accedes desde otra máquina, el proxy de Vite acaba en localhost; usa
> host `0.0.0.0` del backend y define `VITE_API_BASE_URL=http://<ip>:8000`
> (por ejemplo en `frontend/.env`) para apuntar directamente a la API.

### 4. Ver todos los servicios (opcional, WSL con systemd)

Por defecto, WSL2 no arranca systemd, así que `/api/services` devuelve una
respuesta **controlada** («servicio no disponible») en lugar de fallar.
Para probar el estado real de servicios, activa systemd en WSL:

```bash
# En WSL, editar /etc/wsl.conf (requiere sudo)
sudo tee /etc/wsl.conf > /dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Reinicia WSL desde Windows:

```powershell
wsl --shutdown
```

Vuelve a abrir WSL, reinicia backend y frontend, y `/api/services` reportará
los servicios como `Activo` / `Inactivo` / `Fallido`.

---

## Migración a un servidor Linux real

El código no depende de WSL: `psutil` lee métricas reales y systemctl funciona
igual en un servidor. Cambios recomendados para producción:

1. **Servir el frontend compilado**: `npm run build` (genera `frontend/dist/`)
   y súbelo con Nginx/Apache, o hazlo servir desde FastAPI.
2. **Servir la API con un proceso gestionado**. Crear un unit systemd:

```ini
# /etc/systemd/system/system-status-api.service
[Unit]
Description=System Status API
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/system_status_vps/backend
Environment="SYSSTATUS_CORS_ORIGINS=https://tu-dominio.com"
ExecStart=/opt/system_status_vps/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now system-status-api
```

3. **Dominio + HTTPS**: proxy inverso (Caddy o Nginx) del frontend hacia
   `http://127.0.0.1:8000`.
4. Variables de entorno disponibles (ver `backend/app/core/config.py`):
   - `SYSSTATUS_ENV` — `development` | `production`
   - `SYSSTATUS_CORS_ORIGINS` — lista de orígenes permitidos separados por coma
   - `SYSSTATUS_MAX_PROCESSES` — límite máximo del endpoint de procesos

---

## Decisiones y limitaciones del MVP

- **Historial de la gráfica**: se acumula **en el cliente** durante la sesión
  (polling cada 3 s). No hay histórico persistido; para eso se planifica una
  tabla en Redis/SQLite en el futuro.
- **CPU por proceso**: psutil necesita dos lecturas; el endpoint usa una
  pequeña pausa (~0,1 s) para obtener porcentajes reales.
- **Red**: solo contadores acumulados (bytes enviados/recibidos). Las tasas
  (Mbps) y las interfaces por separado quedan como mejora futura.
- **Servicios**: si no hay systemd/SysV, se devuelve `available:false` con un
  mensaje claro; la API nunca rompe.
- **Sin autenticación**: diseñado para uso local en una red de confianza.
- **Sin base de datos**: todavía no es necesaria en el MVP.

## Hoja de ruta (siguiente iteraciones)

- [ ] Histórico de métricas (persistencia) y visualización por rango de fechas.
- [ ] Alertas por umbrales (CPU/RAM/disco) vía WebSocket o polling.
- [ ] Autenticación y roles (admin / lectura).
- [ ] Soporte multi-servidor (agente remoto o SSH).
- [ ] Alertas por email y notificaciones.