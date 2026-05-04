#!/bin/bash
# Script para rodar migrations e seed do banco
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"
npx prisma migrate deploy
npx prisma db seed
