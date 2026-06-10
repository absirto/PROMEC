#!/bin/sh
# Script para buildar e rodar o frontend em Docker
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

if [ -n "$VITE_API_URL" ]; then
	docker build --build-arg VITE_API_URL="$VITE_API_URL" -t promec-frontend .
else
	docker build -t promec-frontend .
fi

docker run --rm -p 3000:80 promec-frontend
