#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/scripts/ops/install_backend.sh"
#!/bin/bash
# Script de instalação e inicialização do backend ProMEC
set -e

# 1. Checagem de pré-requisitos
if ! command -v docker &> /dev/null; then
  echo "[ERRO] Docker não encontrado. Instale o Docker antes de continuar."
  exit 1
fi
if ! command -v docker-compose &> /dev/null; then
  echo "[ERRO] Docker Compose não encontrado. Instale o Docker Compose antes de continuar."
  exit 1
fi
if ! command -v npm &> /dev/null; then
  echo "[ERRO] npm não encontrado. Instale o Node.js/npm antes de continuar."
  exit 1
fi

# 2. Subir serviços de banco e cache
cd "$(dirname "$0")"
echo "[INFO] Subindo banco de dados e Redis via Docker Compose..."
docker-compose up -d db redis

# 3. Instalar dependências do backend
npm install

# 4. Gerar Prisma Client, criar tabelas (BD vazio) e dados iniciais (seed)
npx prisma generate
npx prisma migrate deploy
npx prisma db seed

# 5. Instalar dependências globais úteis (opcional)
# npm install -g prisma

# 6. Iniciar o backend
npm run build
npm start

echo "[OK] Backend ProMEC rodando em http://localhost:3000"
echo "Documentação da API: http://localhost:3000/api-docs"
