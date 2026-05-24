#!/usr/bin/env bash
# Setup Cloudflare R2 env for kira-queue logo upload.
# Requires: curl, jq
# Usage:
#   export CLOUDFLARE_API_TOKEN="your_api_token"   # Account → API Tokens → Create (R2 Edit on kira-r2)
#   ./scripts/setup-r2-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-451bc9b2fc048e958bffb2e78b9f8ca9}"
BUCKET="${R2_BUCKET:-kira-r2}"
API_BASE="https://api.cloudflare.com/client/v4"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "ERROR: Set CLOUDFLARE_API_TOKEN (Cloudflare dashboard → My Profile → API Tokens)"
  echo "  Needs: Account → R2 → Edit (scoped to bucket ${BUCKET})"
  echo "  https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

auth_header() {
  echo "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
}

echo "==> Account ${ACCOUNT_ID}, bucket ${BUCKET}"

echo "==> Enable R2 public development URL (r2.dev)..."
managed_put=$(curl -sS -X PUT \
  "${API_BASE}/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/domains/managed" \
  -H "$(auth_header)" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}')
if ! echo "$managed_put" | jq -e '.success == true' >/dev/null 2>&1; then
  echo "WARN: Could not enable managed domain (may already be enabled):"
  echo "$managed_put" | jq '.' 2>/dev/null || echo "$managed_put"
fi

managed_get=$(curl -sS \
  "${API_BASE}/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/domains/managed" \
  -H "$(auth_header)")
PUBLIC_DOMAIN=$(echo "$managed_get" | jq -r '.result.domain // empty')
ENABLED=$(echo "$managed_get" | jq -r '.result.enabled // false')

if [[ -z "$PUBLIC_DOMAIN" || "$PUBLIC_DOMAIN" == "null" ]]; then
  echo "ERROR: Could not read r2.dev domain. Response:"
  echo "$managed_get" | jq '.'
  exit 1
fi

PUBLIC_BASE_URL="https://${PUBLIC_DOMAIN}"
echo "    Public URL base: ${PUBLIC_BASE_URL} (enabled=${ENABLED})"

if [[ -z "${R2_ACCESS_KEY:-}" || -z "${R2_SECRET_KEY:-}" ]]; then
  echo ""
  echo "==> R2 S3 API credentials (create once in dashboard):"
  echo "    https://dash.cloudflare.com/${ACCOUNT_ID}/r2/api-tokens"
  echo "    → Create API token → Object Read & Write → bucket: ${BUCKET}"
  echo ""
  read -r -p "R2 Access Key ID: " R2_ACCESS_KEY
  read -r -s -p "R2 Secret Access Key: " R2_SECRET_KEY
  echo ""
fi

R2_ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"

append_or_replace() {
  local file="$1"
  local key="$2"
  local value="$3"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    echo "${key}=${value}" >>"$file"
  fi
}

write_env_block() {
  local file="$1"
  echo "" >>"$file"
  echo "# --- Cloudflare R2 (kira-queue logo upload) ---" >>"$file"
  append_or_replace "$file" "R2_ENDPOINT" "$R2_ENDPOINT"
  append_or_replace "$file" "R2_ACCESS_KEY" "$R2_ACCESS_KEY"
  append_or_replace "$file" "R2_SECRET_KEY" "$R2_SECRET_KEY"
  append_or_replace "$file" "R2_BUCKET" "$BUCKET"
  append_or_replace "$file" "R2_PUBLIC_BASE_URL" "$PUBLIC_BASE_URL"
  append_or_replace "$file" "R2_QUOTA_MAX_STORAGE_BYTES" "10737418240"
  append_or_replace "$file" "R2_QUOTA_MAX_CLASS_A_OPS_MONTH" "1000000"
  append_or_replace "$file" "R2_QUOTA_WARN_AT_PERCENT" "90"
}

for target in "${ROOT}/.env" "${ROOT}/kira-queue/.env"; do
  write_env_block "$target"
  echo "==> Wrote R2 vars to ${target}"
done

echo ""
echo "Done. Run DB migration if needed:"
echo "  mysql -h 127.0.0.1 -P 3310 -u kira_user -p kira < database/migrate_leagues_teams_logo_r2.sql"
echo ""
echo "Start stack (MySQL + RabbitMQ), then kira-queue. Logo upload runs after crawl upsert."
