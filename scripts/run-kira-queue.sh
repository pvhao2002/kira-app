#!/usr/bin/env bash
# Run kira-queue with env from repo .env or kira-queue/.env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}/kira-queue"

if [[ -f "${ROOT}/kira-queue/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/kira-queue/.env"
  set +a
elif [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

exec mvn spring-boot:run "$@"
