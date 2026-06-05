#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.ec2}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Run: cp .env.ec2.example .env.ec2"
  exit 1
fi

echo "Using compose: $COMPOSE_FILE"
echo "Using env:     $ENV_FILE"

echo "==> Pull latest images"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull

echo "==> Start / update containers"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

echo "==> Health checks"
curl -fsS http://127.0.0.1:4200/health >/dev/null && echo "kira-ui: ok" || echo "kira-ui: FAIL"
curl -fsS http://127.0.0.1:6868/gateway/actuator/health >/dev/null && echo "kira-gateway: ok" || echo "kira-gateway: FAIL"
curl -fsS http://127.0.0.1:7777/data/actuator/health >/dev/null 2>&1 && echo "kira-data-manager: ok" || echo "kira-data-manager: check manually"
curl -fsS http://127.0.0.1:4000/actuator/health >/dev/null 2>&1 && echo "kira-crawl-java: ok" || echo "kira-crawl-java: FAIL"

echo "==> Prune dangling images"
docker image prune -f

echo "==> Deploy finished"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
