# Exemplo de script de backup do banco PostgreSQL
#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
mkdir -p "$BACKUP_DIR"
date=$(date +%Y-%m-%d_%H-%M-%S)
# Nome do serviço do banco no docker-compose é 'db'
cd "$PROJECT_ROOT"
docker exec $(docker-compose ps -q db) pg_dump -U postgres promec_db > "$BACKUP_DIR/backup_$date.sql"
