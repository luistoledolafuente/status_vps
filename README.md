# System Status

Panel de monitoreo de servidores Linux en tiempo real: CPU, memoria, almacenamiento, red, tráfico mensual, disponibilidad de servicios, detección de anomalías, procesos, servicios (systemd) y alertas con notificaciones por webhook. Backend FastAPI con WebSocket, frontend React.

---

## 1. Requisitos

- Python 3.12+ con pip
- Node.js 18+
- Linux con systemd activado (para el monitoreo de servicios). En WSL2 se debe activar manualmente — ver paso 4.

## 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verifica el estado con `curl http://localhost:8000/api/health` → `{"status":"ok",...}`. Documentación interactiva en `http://localhost:8000/docs`.

## 3. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. En desarrollo, Vite redirige `/api` y `/ws` al backend automáticamente, por lo que REST y WebSocket funcionan sin configuración adicional.

## 4. Activar systemd en WSL2

Por defecto WSL2 no arranca systemd, por lo que la pestaña **Servicios** mostrará avisos en lugar de estados reales. Para activarlo:

```bash
sudo tee /etc/wsl.conf > /dev/null <<'EOF'
[boot]
systemd=true
EOF
```

Reinicia WSL desde Windows (`wsl --shutdown`) y vuelve a arrancar backend y frontend.

## 5. Despliegue en producción (VPS)

Todo el despliegue se hace desde tu equipo conectándote al VPS por SSH:

```bash
ssh usuario@IP_DEL_VPS        # o con clave: ssh -i ~/.ssh/ida_luca usuario@IP_DEL_VPS
```

> Si el VPS tiene firewall (UFW), abre el puerto del frontend cuando corresponda:
> `sudo ufw allow 5173/tcp` (Docker) o `sudo ufw allow 80/tcp` (manual con nginx en 80).

### 5.1 Prerrequisitos

Sobre un VPS Ubuntu/Debian:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git
```

**Para la ruta A (Docker):**

```bash
sudo apt install -y docker.io docker-compose-v2 docker-buildx-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # vuelve a entrar por SSH para aplicar el grupo
```

**Para la ruta B (manual):**

```bash
sudo apt install -y python3-venv python3-pip nodejs npm nginx
```

### 5.2 Clonar el repositorio

```bash
git clone https://github.com/luistoledolafuente/status_vps.git
cd status_vps
```

### 5.3 Opción A: Docker (recomendado)

1. Crea el archivo de configuración y ajústalo:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

2. Cambia al menos estas variables para producción:

| Variable | Valor recomendado |
|---|---|
| `SYSSTATUS_ENV` | `production` |
| `SYSSTATUS_AUTH_ENABLED` | `true` (o `false` si es red privada) |
| `SYSSTATUS_ADMIN_PASSWORD` / `VIEWER_PASSWORD` | contraseñas fuertes |
| `SYSSTATUS_JWT_SECRET` | `openssl rand -hex 32` |
| `SYSSTATUS_WEBHOOK_URL` | URL de tu webhook (vacío = desactivado) |
| `SYSSTATUS_TRACKED_SERVICES` | los servicios de tu servidor |
| `SYSSTATUS_CHECKS` | tus objetivos de disponibilidad |
| `SYSSTATUS_TRAFFIC_QUOTA_GB` | la cuota de tu plan |

3. Levanta todo (compila el frontend y levanta backend + nginx):

```bash
docker compose up --build -d
```

4. Verifica:

```bash
curl http://localhost:5173/api/health     # -> {"status":"ok",...}
docker compose ps
docker compose logs -f backend            # registros en vivo
```

5. Abre **`http://IP_DEL_VPS:5173`** (nginx sirve el SPA y proxya REST + WebSocket al backend, todo en el mismo origen, sin CORS).

**Actualizar** después de un `git pull`:

```bash
git pull && docker compose up --build -d
```

**Apagar / reiniciar**:

```bash
docker compose down        # detiene contenedores
docker compose restart     # reinicia sin recompilar
```

### 5.4 Opción B: Manual (sin Docker)

**Backend** (puerto 8000):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env                  # mismos valores que la ruta A
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Para probar primero: `curl http://localhost:8000/api/health`.

**Frontend** (compila el SPA a `frontend/dist/`):

```bash
cd ../frontend
npm ci
npm run build
```

**nginx** sirve `dist/` y proxya REST + WebSocket al backend. Crea `/etc/nginx/sites-available/status`:

```nginx
server {
    listen 80;
    server_name _;
    root /home/USUARIO/status_vps/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket: obligatorio el header de upgrade
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Habilítalo:

```bash
sudo ln -s /etc/nginx/sites-available/status /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Abre **`http://IP_DEL_VPS`** (puerto 80).

**Recomendado:** arrancar el backend como servicio systemd (`/etc/systemd/system/sysstatus-backend.service`):

```ini
[Unit]
Description=System Status backend
After=network.target

[Service]
WorkingDirectory=/home/USUARIO/status_vps/backend
ExecStart=/home/USUARIO/status_vps/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
User=USUARIO

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now sysstatus-backend
sudo systemctl restart sysstatus-backend   # tras cada actualización del backend
```

> Recuerda: en Docker el frontend vive en `http://IP_DEL_VPS:5173`; en la ruta manual sirve en el puerto 80.

## 6. Uso del panel

- **Resumen**: KPIs en vivo (actualización automática cada 2 s por WebSocket), gráficas de tendencia, almacenamiento por partición y tráfico de red.
- **Salud del servidor**: score de anomalía (0-100) que compara el comportamiento actual contra la línea base histórica, y tráfico del mes vs. la cuota del plan.
- **Disponibilidad**: comprobaciones HTTP y TCP de tus servicios (nginx, API, puerto SSH…) con tiempo de respuesta.
- **Procesos**: top por CPU o memoria, con buscador.
- **Servicios**: seguimiento de los servicios clave, listado completo con filtros por estado y buscador.
- **Alertas**: umbrales configurados, alertas activas y resueltas recientemente. Las alertas requieren que el umbral se supere durante `SYSSTATUS_ALERT_SUSTAIN_SECONDS` segundos para evitar falsas alarmas.

## 7. Notificaciones (webhook)

Las alertas se pueden enviar a un webhook genérico que acepte `POST` JSON: basta una URL para Telegram, Discord, Slack, ntfy o un endpoint propio. Cada evento incluye `event` (`alert_raised` / `alert_resolved`), `severity`, `title`, `message`, `metric`, `value`, `threshold`, `hostname` y `timestamp`.

```bash
SYSSTATUS_WEBHOOK_URL=https://hooks.slack.com/services/XXXX/YYYY/ZZZZ
```

Para verificar la integración de extremo a extremo:

```bash
curl -X POST http://localhost:8000/api/alerts/test
```

## 8. Configuración

Archivo `backend/.env` (prefijo `SYSSTATUS_`). Las variables más relevantes:

| Variable | Default | Descripción |
|---|---|---|
| `SYSSTATUS_TRACKED_SERVICES` | `nginx,postgresql,redis,ssh,cron` | Servicios en seguimiento |
| `SYSSTATUS_ALERT_CPU_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de CPU (%) |
| `SYSSTATUS_ALERT_MEMORY_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de memoria (%) |
| `SYSSTATUS_ALERT_DISK_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de disco (%) |
| `SYSSTATUS_ALERT_SUSTAIN_SECONDS` | `30` | Duración mínima del umbral antes de alertar |
| `SYSSTATUS_WEBHOOK_URL` | — | Webhook para notificaciones (vacío = desactivado) |
| `SYSSTATUS_TRAFFIC_QUOTA_GB` | `0` | Cuota mensual de transferencia en GB (0 = sin cuota) |
| `SYSSTATUS_CHECKS` | — | Comprobaciones: `nombre=http://host,ssh=tcp://host:22` |
| `SYSSTATUS_HISTORY_DB_PATH` | `data/history.db` | Base de datos SQLite del histórico |
| `SYSSTATUS_ANOMALY_CRITICAL` | `80` | Score de anomalía que dispara alerta |
| `SYSSTATUS_WS_INTERVAL_SECONDS` | `2` | Frecuencia del envío en vivo |
| `SYSSTATUS_AUTH_ENABLED` | `false` | Exige autenticación (JWT) en la API |
| `SYSSTATUS_JWT_SECRET` | — | **Cambiarlo antes de activar auth** |
| `SYSSTATUS_ADMIN_PASSWORD` / `VIEWER_PASSWORD` | `admin123` / `viewer123` | Credenciales de los roles |

Con `SYSSTATUS_AUTH_ENABLED=true`, autentícate en `POST /api/auth/token` (usuario/contraseña) y usa el token como `Authorization: Bearer <token>`.

## 9. Solución de problemas

| Problema | Solución |
|---|---|
| Página en blanco | Recarga con Ctrl+Shift+R (caché del navegador). |
| `python3: venv` no existe | `sudo apt install -y python3-venv` y recrea el entorno virtual. |
| Servicios muestran "no disponible" | Activa systemd (paso 4) o despliega en un servidor Linux real. |
| El disco marca ~0% | Es correcto en WSL: el disco virtual es enorme y casi vacío. El KPI muestra la partición más usada. |
| No se conecta el WebSocket (desarrollo) | El primer intento del navegador puede fallar al arrancar Vite; se reconecta solo. Verifica que el backend esté en el puerto 8000. |
| Las comprobaciones no aparecen | Verifica el formato de `SYSSTATUS_CHECKS` (`nombre=objetivo` con esquema `http://`, `https://` o `tcp://`). |
| El tráfico mensual no muestra cuota | Configura `SYSSTATUS_TRAFFIC_QUOTA_GB` con la cuota de tu plan. |
| El score de salud está en 0 | Es normal: necesita al menos ~30 minutos de histórico para establecer la línea base. |

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado + observabilidad (latencia, clientes WebSocket) |
| GET | `/api/metrics/summary` | CPU, RAM, disco, red, uptime, tráfico mensual, salud y disponibilidad |
| GET | `/api/metrics/processes?limit=12&sort_by=cpu` | Procesos (`cpu` / `memory` / `name`) |
| GET | `/api/metrics/history?limit=200` | Histórico para las gráficas |
| GET | `/api/services` | Servicios + seguimiento |
| GET | `/api/alerts` | Alertas y umbrales |
| POST | `/api/alerts/test` | Envía una notificación de prueba al webhook |
| POST | `/api/auth/token` | Autenticación JWT (opcional) |
| WS | `/ws/metrics` | Datos en vivo cada 2 s |
| GET | `/docs` | Documentación interactiva |
