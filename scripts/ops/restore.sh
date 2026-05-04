# Exemplo de script de restore do banco PostgreSQL
#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
if [ -z "$1" ]; then
  echo "Uso: $0 <arquivo_backup.sql>"
  exit 1
fi
BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  # tenta buscar no diretório de backups relativo ao script
  BACKUP_FILE="$SCRIPT_DIR/backups/$1"
  if [ ! -f "$BACKUP_FILE" ]; then
    echo "Arquivo de backup não encontrado: $1"
    exit 2
  fi
fi
cd "$PROJECT_ROOT"
docker exec -i $(docker-compose ps -q db) psql -U postgres promec_db < "$BACKUP_FILE"
