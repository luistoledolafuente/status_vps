#!/usr/bin/env bash
set -euo pipefail

# Deploy de System Status en un VPS Ubuntu (ruta manual, sin Docker).
# Uso: bash deploy/setup.sh
# Supone: git clone del repo, Node.js >= 22 instalado y .env creado en
# backend-node/ (copiar .env.example si no existe, el script lo hace).

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy"
RUN_USER="${SUDO_USER:-$(id -un)}"

echo "==> Backend Node: dependencias y build"
cd "$REPO_DIR/backend-node"
if [ ! -f .env ]; then
    cp .env.example .env
    echo "    (.env creado a partir de .env.example; ajusta los valores)"
fi
# Asegura SYSSTATUS_PORT=8100 (no pisa otros proyectos que usen 8000)
if grep -q '^SYSSTATUS_PORT=' .env; then
    sed -i 's/^SYSSTATUS_PORT=.*/SYSSTATUS_PORT=8100/' .env
else
    echo 'SYSSTATUS_PORT=8100' >> .env
fi
npm ci
npm run build

echo "==> Backend: servicio systemd (node dist/main.js)"
sudo cp "$DEPLOY_DIR/sysstatus-backend.service" /etc/systemd/system/
sudo sed -i "s|/home/rodrigo/project/vps/status_vps|$REPO_DIR|g" /etc/systemd/system/sysstatus-backend.service
sudo sed -i "s/User=rodrigo/User=$RUN_USER/g" /etc/systemd/system/sysstatus-backend.service
sudo systemctl daemon-reload
sudo systemctl enable sysstatus-backend
sudo systemctl restart sysstatus-backend

echo "==> Frontend: build"
cd "$REPO_DIR/frontend"
npm ci
npm run build

echo "==> Frontend: dist a /var/www/status (sin problemas de permisos de /home)"
sudo mkdir -p /var/www/status
sudo cp -r "$REPO_DIR/frontend/dist/." /var/www/status/
sudo chown -R www-data:www-data /var/www/status

echo "==> nginx: sitio status en puerto 8090"
sudo cp "$DEPLOY_DIR/nginx-status.conf" /etc/nginx/sites-available/status
sudo ln -sfn /etc/nginx/sites-available/status /etc/nginx/sites-enabled/status
sudo nginx -t
sudo systemctl reload nginx

echo "==> Firewall (si UFW está activo)"
if sudo ufw status | grep -q "Status: active"; then
    sudo ufw allow 8090/tcp
fi

echo ""
echo "Listo. Panel en http://IP_DEL_VPS:8090"
echo "Comprobación:"
echo "  curl http://localhost:8090/api/health"
echo "  curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8090/"
echo "Logs: journalctl -u sysstatus-backend -f"
