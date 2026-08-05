# System Status

Panel de monitoreo de servidores Linux en tiempo real: CPU, memoria, almacenamiento, red, tráfico mensual, disponibilidad de servicios, detección de anomalías, procesos, servicios (systemd) y alertas con notificaciones por webhook, Telegram y correo. Backend NestJS (TypeScript) con WebSocket, frontend React.

---

## 1. Requisitos

- Node.js 22+ (usa el `node:sqlite` nativo; sin dependencias compiladas)
- npm
- Linux con systemd activado (para el monitoreo de servicios). En WSL2 se debe activar manualmente — ver paso 4.

## 2. Backend

```bash
cd backend-node
npm install
cp .env.example .env
npm run dev        # compila y arranca (o: npm run build && node dist/main.js)
```

Verifica el estado con `curl http://localhost:8000/api/health` → `{"status":"ok",...}`.

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
> `sudo ufw allow 5173/tcp` (Docker) o `sudo ufw allow 8090/tcp` (manual con nginx; `setup.sh` lo hace solo).

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
sudo apt install -y nginx
```

> Si `node`/`npm` no existen o son viejos, instálalos desde NodeSource (v22+):
> `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`.

### 5.2 Clonar el repositorio

```bash
git clone https://github.com/luistoledolafuente/status_vps.git
cd status_vps
```

### 5.3 Opción A: Docker (recomendado)

1. Crea el archivo de configuración y ajústalo:

```bash
cp backend-node/.env.example backend-node/.env
nano backend-node/.env
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

**1. Backend** (una sola vez):

```bash
cd backend-node
npm ci
cp .env.example .env
nano .env                  # mismos valores que la ruta A
cd ..
```

**2. Desplegar** (build del frontend + nginx en puerto 8090 + servicio systemd):

```bash
bash deploy/setup.sh
```

El script:

- instala dependencias y compila `backend-node` (si no existe `.env` lo crea desde `.env.example`);
- copia `deploy/sysstatus-backend.service` a systemd y lo arranca (`node dist/main.js`, backend ligado a `127.0.0.1:8000`, solo accesible vía nginx);
- compila el frontend y copia `dist/` a `/var/www/status` (evita el 500 de permisos al servir desde `/home/`);
- instala `deploy/nginx-status.conf` como sitio `status` en el **puerto 8090** y recarga nginx;
- abre `8090/tcp` en UFW si está activo.

Abre **`http://IP_DEL_VPS:8090`**. El puerto 8090 evita chocar con webs existentes en el 80/443.

**Actualizar** después de un `git pull`:

```bash
git pull
bash deploy/setup.sh      # rebuild + recarga del sitio y del servicio
```

**Verificar:**

```bash
curl http://localhost:8090/api/health      # -> {"status":"ok",...}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8090/   # 200
```

> Recuerda: en Docker el frontend vive en `http://IP_DEL_VPS:5173`; en la ruta manual sirve en el puerto 8090.

## 6. Uso del panel

El panel pide **iniciar sesión** (usuario/contraseña de `SYSSTATUS_ADMIN_USERNAME` / `VIEWER_*`). Con `SYSSTATUS_AUTH_ENABLED=true` la API y el WebSocket exigen el token JWT; con `false` la sesión es solo de cortesía.

- **Resumen**: KPIs en vivo (actualización automática cada 2 s por WebSocket), gráficas de tendencia, almacenamiento por partición y tráfico de red.
- **Salud del servidor**: score de anomalía (0-100) que compara el comportamiento actual contra la línea base histórica, y tráfico del mes vs. la cuota del plan.
- **Disponibilidad**: comprobaciones HTTP y TCP de tus servicios (nginx, API, puerto SSH…) con tiempo de respuesta.
- **Procesos**: top por CPU o memoria, con buscador.
- **Servicios**: seguimiento de los servicios clave, listado completo con filtros por estado y buscador.
- **Alertas**: umbrales configurados, alertas activas y resueltas recientemente. Las alertas requieren que el umbral se supere durante `SYSSTATUS_ALERT_SUSTAIN_SECONDS` segundos para evitar falsas alarmas.

## 7. Notificaciones (webhook, Telegram y correo)

Las alertas se pueden enviar a **tres canales** a la vez:

- **Webhook genérico** (`SYSSTATUS_WEBHOOK_URL`): `POST` JSON, compatible con Telegram, Discord, Slack, ntfy o un endpoint propio. Cada evento incluye `event` (`alert_raised` / `alert_resolved`), `severity`, `title`, `message`, `metric`, `value`, `threshold`, `hostname` y `timestamp`.
- **Telegram**: `SYSSTATUS_TELEGRAM_BOT_TOKEN` + `SYSSTATUS_TELEGRAM_CHAT_ID` (Bot API `sendMessage`).
- **Correo**: `SYSSTATUS_SMTP_*` (SMTP con STARTTLS/TLS; destino `SYSSTATUS_SMTP_TO_EMAILS`, varios separados por comas).

Estado de cada canal en `GET /api/alerts/channels`; prueba manual con `POST /api/alerts/test` (envía una notificación de prueba por cada canal configurado).

## 8. Configuración

Archivo `backend-node/.env` (prefijo `SYSSTATUS_`). Las variables más relevantes:

| Variable | Default | Descripción |
|---|---|---|
| `SYSSTATUS_TRACKED_SERVICES` | `nginx,postgresql,redis,ssh,cron` | Servicios en seguimiento |
| `SYSSTATUS_ALERT_CPU_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de CPU (%) |
| `SYSSTATUS_ALERT_MEMORY_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de memoria (%) |
| `SYSSTATUS_ALERT_DISK_WARNING` / `_CRITICAL` | `80` / `90` | Umbrales de disco (%) |
| `SYSSTATUS_ALERT_SUSTAIN_SECONDS` | `30` | Duración mínima del umbral antes de alertar |
| `SYSSTATUS_WEBHOOK_URL` | — | Webhook para notificaciones (vacío = desactivado) |
| `SYSSTATUS_TELEGRAM_BOT_TOKEN` / `SYSSTATUS_TELEGRAM_CHAT_ID` | — | Notificaciones por Telegram |
| `SYSSTATUS_SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM_EMAIL` / `SMTP_TO_EMAILS` | — | Notificaciones por correo |
| `SYSSTATUS_TRAFFIC_QUOTA_GB` | `0` | Cuota mensual de transferencia en GB (0 = sin cuota) |
| `SYSSTATUS_CHECKS` | — | Comprobaciones: `nombre=http://host,ssh=tcp://host:22` |
| `SYSSTATUS_HISTORY_DB_PATH` | `data/history.db` | Base de datos SQLite del histórico |
| `SYSSTATUS_ANOMALY_CRITICAL` | `80` | Score de anomalía que dispara alerta |
| `SYSSTATUS_WS_INTERVAL_SECONDS` | `2` | Frecuencia del envío en vivo |
| `SYSSTATUS_AUTH_ENABLED` | `false` | Exige autenticación (JWT) en la API |
| `SYSSTATUS_JWT_SECRET` | — | **Cambiarlo antes de activar auth** |
| `SYSSTATUS_ADMIN_PASSWORD` / `VIEWER_PASSWORD` | `admin123` / `viewer123` | Credenciales de los roles |

Con `SYSSTATUS_AUTH_ENABLED=true`, autentícate en `POST /api/auth/token` (usuario/contraseña en form-urlencoded) y usa el token como `Authorization: Bearer <token>`. El WebSocket `/ws/metrics` acepta el token como `?token=...` en la URL.

## 9. Solución de problemas

| Problema | Solución |
|---|---|
| Página en blanco | Recarga con Ctrl+Shift+R (caché del navegador). |
| `node: sqlite no disponible` | Usa Node.js 22+ (el SQLite nativo se degrada a memoria si falta). |
| Servicios muestran "no disponible" | Activa systemd (paso 4) o despliega en un servidor Linux real. |
| El disco marca ~0% | Es correcto en WSL: el disco virtual es enorme y casi vacío. El KPI muestra la partición más usada. |
| No se conecta el WebSocket (desarrollo) | El primer intento del navegador puede fallar al arrancar Vite; se reconecta solo. Verifica que el backend esté en el puerto 8000. |
| No conecta con `SYSSTATUS_AUTH_ENABLED=true` | Recarga y vuelve a iniciar sesión: el WS reaparece con `?token=...`; un token expirado cierra la sesión (se vuelve a la pantalla de login). |
| Servicios muestran "no disponible" | Activa systemd (paso 4) o despliega en un servidor Linux real. |
| El disco marca ~0% | Es correcto en WSL: el disco virtual es enorme y casi vacío. El KPI muestra la partición más usada. |
| No se conecta el WebSocket (desarrollo) | El primer intento del navegador puede fallar al arrancar Vite; se reconecta solo. Verifica que el backend esté en el puerto 8000. |
| Las comprobaciones no aparecen | Verifica el formato de `SYSSTATUS_CHECKS` (`nombre=objetivo` con esquema `http://`, `https://` o `tcp://`). |
| El tráfico mensual no muestra cuota | Configura `SYSSTATUS_TRAFFIC_QUOTA_GB` con la cuota de tu plan. |
| El score de salud está en 0 | Es normal: necesita al menos ~30 minutos de histórico para establecer la línea base. |
| nginx da 500 al abrir el panel (manual) | El dist se sirve desde `/var/www/status` (ver `deploy/setup.sh`); nginx no puede leer rutas dentro de `/home/`. |
| El panel no aparece (manual) | Verifica `systemctl status sysstatus-backend nginx` y que el sitio `status` esté en `sites-enabled` (el script lo crea). |

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado + observabilidad (latencia, clientes WebSocket) |
| GET | `/api/metrics/summary` | CPU, RAM, disco, red, uptime, tráfico mensual, salud y disponibilidad |
| GET | `/api/metrics/processes?limit=12&sort_by=cpu` | Procesos (`cpu` / `memory` / `name`) |
| GET | `/api/metrics/history?limit=200` | Histórico para las gráficas |
| GET | `/api/services` | Servicios + seguimiento |
| GET | `/api/alerts` | Alertas y umbrales |
| GET | `/api/alerts/channels` | Estado de los canales de notificación (webhook, Telegram, correo) |
| POST | `/api/alerts/test` | Envía una notificación de prueba por cada canal configurado |
| POST | `/api/auth/token` | Autenticación JWT (opcional) |
| WS | `/ws/metrics` | Datos en vivo cada 2 s |
