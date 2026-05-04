#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Execute como root: sudo bash scripts/ops/setup-vps.sh"
  exit 1
fi

apt-get update -y
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não foi instalado corretamente."
  exit 1
fi

systemctl enable --now docker
systemctl enable --now nginx

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cp "$PROJECT_ROOT/deploy/nginx/promec.conf" /etc/nginx/sites-available/promec.conf
ln -sf /etc/nginx/sites-available/promec.conf /etc/nginx/sites-enabled/promec.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "Bootstrap base concluído. Próximos passos:"
echo "1. Copie Backend/.env.production.example para Backend/.env.production e ajuste os valores."
echo "2. No diretório raiz do monorepo, suba a stack com: docker compose -f docker-compose.prod.yml up -d --build"
echo "3. Emita SSL com: certbot --nginx -d ucalcom.com -d www.ucalcom.com -d api.ucalcom.com"