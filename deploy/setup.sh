#!/usr/bin/env bash
set -euo pipefail

# Deploy de System Status en un VPS Ubuntu (ruta manual, sin Docker).
# Uso: bash deploy/setup.sh
# Supone: git clone del repo, backend con venv + .env creados (ver README).

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy"
RUN_USER="${SUDO_USER:-$(id -un)}"

echo "==> Backend: servicio systemd"
sudo cp "$DEPLOY_DIR/sysstatus-backend.service" /etc/systemd/system/
sudo sed -i "s|/home/rodrigo/project/vps/status_vps|$REPO_DIR|g" /etc/systemd/system/sysstatus-backend.service
sudo sed -i "s/User=rodrigo/User=$RUN_USER/g" /etc/systemd/system/sysstatus-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now sysstatus-backend

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
