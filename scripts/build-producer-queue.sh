#!/usr/bin/env bash
# Build and optionally push kira-producer + kira-queue for linux/amd64 (EC2 / Portainer).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="${REGISTRY:-kira2308}"
TAG="${TAG:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-false}"

cd "$ROOT"

if ! docker buildx inspect kira-multiarch >/dev/null 2>&1; then
  docker buildx create --name kira-multiarch --use
else
  docker buildx use kira-multiarch
fi

build_one() {
  local name="$1"
  local context="$2"
  local tags=(
    "-t" "${REGISTRY}/${name}:${TAG}"
  )
  if [[ -n "${GITHUB_SHA:-}" ]]; then
    tags+=("-t" "${REGISTRY}/${name}:${GITHUB_SHA}")
  fi

  local args=(
    buildx build
    --platform "${PLATFORM}"
    "${tags[@]}"
    -f "${context}/Dockerfile"
    "${context}"
  )
  if [[ "${PUSH}" == "true" ]]; then
    args+=(--push)
  else
    args+=(--load)
    if [[ "${PLATFORM}" != "linux/$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')" ]]; then
      echo "ERROR: --load only works for native platform. Set PUSH=true to push cross-platform builds."
      exit 1
    fi
  fi

  echo "==> Building ${REGISTRY}/${name}:${TAG} (${PLATFORM})"
  docker "${args[@]}"
}

build_one kira-producer "${ROOT}/kira-producer"
build_one kira-queue "${ROOT}/kira-queue"

echo "==> Done (${REGISTRY}/*:${TAG}, platform=${PLATFORM}, push=${PUSH})"
