# System Status

Panel de monitoreo de servidores Linux en tiempo real: CPU, memoria, disco, red, tráfico mensual, servicios, procesos, **proyectos PM2 con logs y acciones**, detección de anomalías y **alertas por Telegram / correo / webhook**.

- **Backend**: NestJS (TypeScript) + WebSocket → `backend-node/`
- **Frontend**: React + Vite → `frontend/`
- **Despliegue**: `deploy/`

---

## 1. Requisitos

| Necesitas | Versión |
|---|---|
| **Node.js** | 22 o superior |
| **npm** | incluido con Node |
| **Sistema** | Linux (para monitorear servicios systemd). En WSL2 hay que activar systemd (ver [4](#4-trabajar-en-wsl2-opcional)) |

---

## 2. Probar en local (rápido)

> Abre **dos terminales** en la carpeta del proyecto.

**Terminal 1 — Backend:**

```bash
cd backend-node
npm install
cp .env.example .env
npm run dev
```

Debes ver al final algo como: `System Status API listening on 0.0.0.0:8000`.

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173** en el navegador.

> En modo desarrollo el frontend reenvía `/api` y `/ws` al backend solo, no hay que configurar nada más.

---

## 3. Configurar las notificaciones (Telegram y correo)

Cuando una alerta se activa o se resuelve, se envía automáticamente por **todos** los canales que tengas configurados. Edita `backend-node/.env` (y reinicia el backend después).

> Puedes comprobar un canal desde el panel en **Alertas → Canales de notificación → Enviar prueba**.

### 3.1 Telegram

1. Abre Telegram y busca **@BotFather** → `/newbot` → crea tu bot y guarda el **token**.
2. Abre tu bot, pulsa **Iniciar** (envía `/start`).
3. Obtén tu `chat_id` en el navegador con:
   `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
4. En el `.env`:

```ini
SYSSTATUS_TELEGRAM_BOT_TOKEN=123456789:AAA...tu-token
SYSSTATUS_TELEGRAM_CHAT_ID=123456789
```

### 3.2 Correo por SMTP

**Con Gmail (recomendado):**

```env
SYSSTATUS_SMTP_HOST=smtp.gmail.com
SYSSTATUS_SMTP_PORT=587
SYSSTATUS_SMTP_USERNAME=tu-cuenta@gmail.com
SYSSTATUS_SMTP_PASSWORD=tu-app-password
SYSSTATUS_SMTP_FROM_EMAIL=tu-cuenta@gmail.com
SYSSTATUS_SMTP_TO_EMAILS=destino@example.com
```

**Para crear la app password de Gmail:**
1. https://myaccount.google.com → **Seguridad** → activa **Verificación en 2 pasos**.
2. Seguridad → **Contraseñas de aplicaciones** → crea una para "SystemStatus".
3. Usa los 16 caracteres como `SYSSTATUS_SMTP_PASSWORD`.

**Para Hotmail/Outlook:**
```env
SYSSTATUS_SMTP_HOST=smtp.office365.com
SYSSTATUS_SMTP_PORT=587
SYSSTATUS_SMTP_USERNAME=tu-cuenta@hotmail.com
SYSSTATUS_SMTP_PASSWORD=tu-app-password-o-normal
SYSSTATUS_SMTP_FROM_EMAIL=tu-cuenta@hotmail.com
SYSSTATUS_SMTP_TO_EMAILS=destino@example.com
```

> A veces Microsoft bloquea SMTP básico (error `535 5.7.139`) y solo Gmail u otros SMTP funcionan; en ese caso usa Gmail u otro proveedor SMTP.

### 3.3 Webhook (opcional)

```env
SYSSTATUS_WEBHOOK_URL=https://tu-servicio/de/webhook
```

Recibe un `POST` JSON con `event`, `severity`, `title`, `message`, `metric`, `value`, `threshold`, `hostname` y `timestamp`.

---

## 4. Despliegue en producción (VPS)

Puedes usar **Docker** (opción A, recomendada) o **manual con nginx** (opción B).

### 4.0 Prepara el VPS

Entra por SSH:

```bash
ssh usuario@IP_DEL_VPS
```

Instala lo básico y clona el repo:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/luistoledolafuente/status_vps.git
cd status_vps
```

### 4.1 Opción A — Docker (recomendado)

```bash
sudo apt install -y docker.io docker-compose-v2 docker-buildx-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER      # vuelve a entrar por SSH
```

Copiar y editar la configuración:

```bash
cp backend-node/.env.example backend-node/.env
nano backend-node/.env
```

Levanta todo:

```bash
docker compose up --build -d
```

Abre **http://IP_DEL_VPS:5173**.

**Actualizar**:

```bash
git pull && docker compose up --build -d
```

### 4.2 Opción B — Manual (nginx + systemd)

```bash
sudo apt install -y nginx          # (ver requisitos de Node 22 si hace falta)
cd backend-node
npm ci
cp .env.example .env
nano .env                         # mismos valores que el local
cd ..
bash deploy/setup.sh
```

Abre **http://IP_DEL_VPS:8090**.

**Actualizar**:

```bash
git pull
bash deploy/setup.sh
```

---

## 5. Uso del panel

> El panel pide iniciar sesión (usuarios en `SYSSTATUS_*`). Con `SYSSTATUS_AUTH_ENABLED=true` la API exige un token JWT; con `false` es solo una capa de protección leve.

| Pestaña | Qué muestra |
|---|---|
| **Resumen** | KPIs en vivo (cada 2 s por WebSocket), tendencias, disco, tráfico |
| **Salud** | Score de anomalía (0-100) contra la línea base histórica |
| **Disponibilidad** | Comprobaciones HTTP/TCP de tus servicios |
| **Procesos** | Top de procesos por CPU o memoria |
| **PM2** | Proyectos de PM2: estado, CPU, memoria, reinicios, uptime, **logs en vivo** y acciones de reinicio/parada/arranque (solo admin) |
| **Servicios** | Estado de los servicios systemd |
| **Alertas** | Canales de notificación con botones de prueba, umbrales, alertas activas y resueltas |

---

## 6. Variables de entorno (`backend-node/.env`)

Las más importantes (hay otras en `.env.example`):

| Variable | Default | Para qué es |
|---|---|---|
| `SYSSTATUS_AUTH_ENABLED` | `true` | Exigir sesión (JWT) en la API (el deploy lo fuerza a `true`) |
| `SYSSTATUS_ADMIN_PASSWORD` / `SYSSTATUS_VIEWER_PASSWORD` | `admin123` / `viewer123` | Contraseñas de acceso |
| `SYSSTATUS_JWT_SECRET` | — | **Cambiar antes de activar auth** |
| `SYSSTATUS_TELEGRAM_BOT_TOKEN` / `SYSSTATUS_TELEGRAM_CHAT_ID` | — | Bot de Telegram |
| `SYSSTATUS_SMTP_HOST` / `SYSSTATUS_SMTP_USERNAME` / `SYSSTATUS_SMTP_PASSWORD` / `SYSSTATUS_SMTP_FROM_EMAIL` / `SYSSTATUS_SMTP_TO_EMAILS` | — | Envío de correo |
| `SYSSTATUS_WEBHOOK_URL` | — | Webhook (vacío = desactivado) |
| `SYSSTATUS_ALERT_CPU_WARNING` / `SYSSTATUS_ALERT_CPU_CRITICAL` | `80` / `90` | Umbrales de CPU (%) |
| `SYSSTATUS_ALERT_MEMORY_WARNING` / `SYSSTATUS_ALERT_MEMORY_CRITICAL` | `80` / `90` | Umbrales de memoria (%) |
| `SYSSTATUS_ALERT_DISK_WARNING` / `SYSSTATUS_ALERT_DISK_CRITICAL` | `80` / `90` | Umbrales de disco (%) |
| `SYSSTATUS_ALERT_SUSTAIN_SECONDS` | `30` | Segundos seguidos sobre el umbral antes de alertar |
| `SYSSTATUS_TRAFFIC_QUOTA_GB` | `0` | Cuota mensual en GB (0 = sin cuota) |
| `SYSSTATUS_CHECKS` | — | `nombre=http://host,ssh=tcp://host:22` |
| `SYSSTATUS_TRACKED_SERVICES` | `nginx,postgresql,redis,ssh,cron` | Servicios monitoreados |

---

## 7. Solución de problemas

| Problema | Solución |
|---|---|
| Página en blanco | Recarga con **Ctrl+Shift+R** (caché). |
| `node: sqlite no disponible` | Necesitas Node.js 22+. |
| Servicios "no disponible" | Activa systemd (WSL) o usa un Linux real. |
| No conecta el WebSocket | Verifica que el backend esté en el puerto configurado (8100 en el VPS, 8000 en local); se reconecta solo. |
| Con `AUTH_ENABLED=true` no conecta | Recarga y vuelve a iniciar sesión (token) y WS lleva `?token=...`. |
| Las comprobaciones no aparecen | Revisa el formato de `SYSSTATUS_CHECKS` (`nombre=http://...` o `tcp://...`). |
| Tráfico sin cuota | Pon `SYSSTATUS_TRAFFIC_QUOTA_GB`. |
| Score de salud en 0 | Es normal: necesita ~30 min de histórico. |
| Correo falla con `535 5.7.139` | Microsoft bloquea SMTP de esa cuenta; usa Gmail u otro SMTP. |
| Correo/Telegram no se configuran | Revisa que el backend se **reinició** después de editar `.env` y que los campos estén vacíos no `${...}`. |

---

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado y observabilidad |
| GET | `/api/metrics/summary` | CPU, RAM, disco, red, tráfico, salud |
| GET | `/api/metrics/processes?limit=12&sort_by=cpu` | Procesos |
| GET | `/api/metrics/history?limit=200` | Histórico de gráficas |
| GET | `/api/services` | Servicios |
| GET | `/api/pm2` | Proyectos PM2 (estado y métricas) |
| GET | `/api/pm2/logs/:id?lines=200` | Últimas líneas de logs de un proyecto |
| POST | `/api/pm2/:id/restart` | Reiniciar (también `stop`, `start`; solo admin) |
| GET | `/api/alerts` | Alertas y umbrales |
| GET | `/api/alerts/channels` | Estado de canales |
| GET | `/api/alerts/test` | Notificación de prueba a todos los canales |
| GET | `/api/alerts/test?channel=telegram` | Prueba de un canal concreto (`email`, `telegram`, `webhook`) |
| POST | `/api/auth/token` | Login JWT (opcional) |
| WS | `/ws/metrics` | Datos en vivo cada 2 s |