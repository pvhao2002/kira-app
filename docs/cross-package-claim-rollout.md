# Cross-Package Claim Rollout

## Feature Flags
- `APP_CLAIM_ENABLED` in `kira-queue` and `kira-crawl` (default `true`).
- Keep both services deployable with claim disabled for emergency rollback.

## Rollout Steps
1. Deploy `kira-gateway` with `crawl_claim_lock` table and `/crawl/claim/*` APIs.
2. Deploy `kira-queue` with claim guard enabled.
3. Deploy `kira-crawl` with claim guard enabled.
4. Observe logs and duplicate rate for at least one full crawl cycle.

## Observability Signals
- Claim granted/denied logs in consumers and crawl scheduler.
- Error logs for claim/release failures from gateway client calls.
- DB checks:
  - Active claims: `claim_status='CLAIMED' and lease_until > now()`
  - Potential stuck claims: very old `last_heartbeat_at`.

## Rollback
- Set `APP_CLAIM_ENABLED=false` in `kira-queue` and `kira-crawl`.
- Keep gateway APIs deployed (safe to keep for future re-enable).
