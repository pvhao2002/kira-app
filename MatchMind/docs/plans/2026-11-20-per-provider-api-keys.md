# Per-provider API keys, provider disable, results permission (UX-027 + UX-061)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax. Migration numbers are `V<next>`: check the highest `V*.sql` first (V13 when written).

## Problem

- Every agent authenticates with one shared `EXTERNAL_API_KEY` (`ApiKeyAuthenticationFilter`). `X-Provider` is
  self-declared, so any key holder can write as any provider, and an unknown code creates a provider
  (`ProviderService.resolve`).
- A leaked or misbehaving agent cannot be stopped alone. The only lever is rotating the key for every agent.
- The same key can call `POST /external/matches/results`, so an agent grades its own predictions.
- plan.md §12 asks for providers list/add/edit/enable-disable/generate/rotate/revoke/activity. Only `GET /providers` exists
  and there is no Providers screen (UX-019).
- The schema already has what is needed: `provider_api_keys` (V1: `key_id`, `secret_hash CHAR(64)`, `status ACTIVE|REVOKED`,
  `revoked_at`, `last_used_at`, `created_by`), `providers.status ACTIVE|DISABLED`, and `external_api_requests.api_key_id`.
  All of it is unused today.

## Options

| | Option | Trade-off |
|---|---|---|
| A | **Per-provider keys in `provider_api_keys`, with scopes. The shared key stays as a legacy path behind a flag until cut-over (recommended).** | Reuses the V1 table and the audit FK. Needs one additive column (`scopes`). The provider comes from the key, so `X-Provider` spoofing ends. Migration is gradual: no agent breaks on deploy day. |
| B | Keep the shared key and add a per-provider `disabled` flag only (UX-061 minimum). | About 1 day of work. It stops a provider but not a leaked key, because the leaked key can claim another `X-Provider`. It does not fix self-grading or §12. Use it only as a stop-gap. |
| C | Signed per-provider JWTs or HMAC request signing. | Strongest option, but ChatGPT Actions, the browser artifact and Sheets scripts can only send a static header. This breaks the agents the product targets. |

**Recommendation: A.** Store the SHA-256 of a high-entropy secret, not BCrypt. The secret is 32 random bytes, so a fast hash
is safe, and every callback stays cheap. This is the same reasoning V1 already documents.

Key format: `mmk_<keyId>_<secret>`.
- `keyId`: 12 base32 characters, unique, safe to show and log.
- `secret`: 43 characters of base64url (32 bytes).
- Lookup: fetch the key row by `keyId` through the unique index, then compare `sha256(secret)` with `MessageDigest.isEqual`.

## Decisions needed from the owner

1. **Permission model for results.** Recommended: new agent keys get the scopes `PREDICTIONS` + `SETTLE_REQUEST` but not
   `RESULTS`. An admin grants `RESULTS` per key, only to a trusted results feeder. Alternative: forbid results from every
   provider key and accept results only through an admin endpoint.
2. **Provider creation after cut-over.** May a per-provider key still auto-create *models*? (Recommended: yes.) Providers are
   then created only by an admin on the Providers screen. This changes the AGENTS.override rule "providers and models are
   created by external calls, never by hand". Approve the rule change.
3. **Legacy shared key.** Keep it accepted (audited as `legacyKey=true`) until a date you choose, then unset `EXTERNAL_API_KEY`?
   Today the API refuses to start without that variable. It becomes optional.
4. **Admin import (`POST /predictions/import`) for a DISABLED provider.** Recommended: refuse with `403 PROVIDER_DISABLED`,
   the same as the API.
5. **Admin result entry.** Do you want `PUT /api/v1/matches/{id}/result` (ADMIN, `change_source='ADMIN'`) in this plan?
   It is the trusted grader if no provider gets `RESULTS`. Recommended: yes, as Task 5.
6. **Rotation overlap.** Rotation is "issue new + revoke old later", and both keys work meanwhile. Is a manual revoke
   enough, or do you want an automatic expiry (`expires_at`)? Recommended: manual (YAGNI).

## Blast radius (GitNexus, upstream)

| Symbol | Risk | Direct dependants |
|---|---|---|
| `ApiKeyAuthenticationFilter` | LOW | `PredictionImportController` (uses `providerCode`), wired in `SecurityConfig` |
| `ProviderService` | LOW | `ApiKeyAuthenticationFilter`, `PredictionImportController`, `ProviderController` |
| `Principals` (`ProviderPrincipal`) | **MEDIUM** | 8 files: `ApiKeyAuthenticationFilter`, `JwtAuthenticationFilter`, `ExternalController`, `PredictionImportController`, `AuthController`, `PromptController`, `SettlementController`, `SecurityConfig` |
| `ExternalController` | LOW | `SecurityConfig` |

`ProviderPrincipal` is a record. Adding the components `keyId` and `scopes` changes its constructor, which has 2 callers:
the filter and `PredictionImportController`. Also check `matchmind-web/src/app/pages/prompts.ts` and `PromptController.forAgent`,
which substitutes `{{EXTERNAL_API_KEY}}`.

## Global constraints

- Never store, log or audit a key or secret. A key is shown once, in the create/rotate response only.
- Key comparison is constant-time. An unknown `keyId` still hashes the presented secret, so timing stays equal.
- Additive migration only. `provider_api_keys` and `providers.status` already exist.
- Errors use the fixed JSON shape: `401 INVALID_API_KEY`, `403 PROVIDER_DISABLED`, `403 PROVIDER_MISMATCH`,
  `403 SCOPE_REQUIRED`. Every rejection is audited (`REJECTED`) with `provider_id` and `api_key_id` when known.

## Review Focus

1. A revoked key, or a key of a DISABLED provider, gets `401`/`403` on the very next request. There is no cache.
2. A per-provider key with `X-Provider` set to another provider gets `403 PROVIDER_MISMATCH`, never a silent override.
3. A legacy shared key after `EXTERNAL_API_KEY` is unset gets `401`, and the app still starts.
4. The `PROVIDER_IDS` cache (1 h TTL) must not let a disabled provider through. The status check never goes through that cache.
5. The prompt "copy for agent" must never put a hashed or other provider's key into a prompt.

---

### Task 1: Migration `V<next>__provider_api_key_scopes.sql`

**Files:** Create `matchmind-api/src/main/resources/db/migration/V<next>__provider_api_key_scopes.sql`.

- [ ] Add the scopes column:
  `ALTER TABLE provider_api_keys ADD COLUMN scopes VARCHAR(16)[] NOT NULL DEFAULT '{PREDICTIONS,SETTLE_REQUEST}'`
  with `CHECK (scopes <@ ARRAY['PREDICTIONS','SETTLE_REQUEST','RESULTS']::varchar[] AND cardinality(scopes) > 0)`.
- [ ] Add the index `ix_provider_api_keys_active` on `(provider_id) WHERE status = 'ACTIVE'`.
- [ ] Add `providers.disabled_at TIMESTAMPTZ` and `providers.disabled_reason TEXT`, with
  `CHECK ((status = 'DISABLED') = (disabled_at IS NOT NULL))`. The backfill is a no-op because every row is ACTIVE.
- [ ] Optional DB guard: a trigger that forbids `UPDATE` of `secret_hash`, `key_id` and `provider_id`. Do it here or let
  UX-088 own it.
- [ ] Verify with `mvn -q compile`, then an IT start (Flyway applies).

### Task 2: Key service + authentication

**Files:**
- Create `provider/ProviderKeyService.java`.
- Modify `security/ApiKeyAuthenticationFilter.java` and `security/Principals.java`.
- Test: `it/ProviderKeysIT.java`.

**Interfaces:**
- `record IssuedKey(UUID id, String keyId, String apiKey, List<String> scopes, Instant createdAt)`. `apiKey` is the full
  `mmk_...` value and is returned once.
- `IssuedKey issue(UUID providerId, String label, Set<String> scopes, UUID actor)`
- `void revoke(UUID keyRowId, UUID actor)` sets `status='REVOKED'` and `revoked_at=now()`. It is idempotent.
- `Optional<KeyMatch> authenticate(String presented)` returns
  `KeyMatch(UUID keyRowId, UUID providerId, String providerCode, String providerStatus, Set<String> scopes)`.
  It is one SQL join `provider_api_keys k JOIN providers p` on `key_id` with `k.status='ACTIVE'`.
- `ProviderPrincipal(UUID providerId, String providerCode, UUID apiKeyId, Set<String> scopes)`. Legacy and admin import
  use `apiKeyId=null` and all scopes.

Filter order:
1. A `mmk_` prefix triggers `authenticate`. No match gives `401 INVALID_API_KEY`.
2. A provider with status `DISABLED` gives `403 PROVIDER_DISABLED`.
3. If `X-Provider` is present and differs from the key's provider, the response is `403 PROVIDER_MISMATCH`.
4. Otherwise, if legacy mode is on (`app.external-api-key` set), run today's shared-key path unchanged, plus the status check.
   That path still auto-creates the provider.
5. Otherwise the response is `401`.
6. On success, throttle-update `last_used_at`:
   `UPDATE provider_api_keys SET last_used_at = now() WHERE id = :id AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')`.
7. Add `apiKeyId` to `ExternalAuditService.Entry` so `external_api_requests.api_key_id` is filled.

- [ ] Write the failing ITs:
  - `issuedKeyAuthenticatesWithoutXProvider`
  - `revokedKeyIs401`
  - `disabledProviderIs403ProviderDisabled`
  - `xProviderMismatchIs403`
  - `legacyKeyStillWorksWhenConfigured`
  - `auditRowCarriesApiKeyIdAndNeverTheSecret` (assert that no column of the audit row contains the secret)
- [ ] Implement, then run `mvn -B verify -Dit.test=ProviderKeysIT`.
- [ ] Make `EXTERNAL_API_KEY` optional:
  - The constructor no longer throws when the variable is empty. It throws only when the variable is set and shorter than
    32 characters.
  - Update `.env.example` and `docker-compose.yml`. `:?` becomes `:-`.

### Task 3: Scope enforcement (results permission)

**Files:** Modify `external/ExternalController.java`. Test: extend `ProviderKeysIT`.

- [ ] Write the failing tests:
  - `resultsWithoutResultsScopeIs403ScopeRequired`
  - `resultsWithScopeApplies`
  - `predictionsWithoutPredictionsScopeIs403`
- [ ] Add `requireScope(caller, "RESULTS")` at the top of `results(...)`. Also add `"PREDICTIONS"` in `submitPrediction`
  (the admin import principal has all scopes) and `"SETTLE_REQUEST"` in `settle`. The check is inside `audited(...)`, so
  the rejection is audited.
- [ ] Decide how the legacy key is treated. Recommended: all scopes, because that is today's behaviour, until cut-over.

### Task 4: Provider admin API

**Files:** Modify `provider/ProviderController.java` and `provider/ProviderService.java`. Test: `it/ProvidersAdminIT.java`.

Endpoints. The `ADMIN` role is already enforced by `SecurityConfig` for non-GET `/api/v1/**`.

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/api/v1/providers` | `{code, name, description?}` | 201 `ProviderView`. `409 PROVIDER_EXISTS` |
| PATCH | `/api/v1/providers/{id}` | `{name?, description?, status?, disabledReason?}` | `ProviderView`. Code is immutable |
| GET | `/api/v1/providers/{id}/keys` | | `[{id, keyId, label, scopes, status, createdAt, lastUsedAt, revokedAt}]`. Never the hash |
| POST | `/api/v1/providers/{id}/keys` | `{label?, scopes?}` | 201 `IssuedKey` (secret shown once). `Cache-Control: no-store` |
| POST | `/api/v1/providers/{id}/keys/{keyId}/revoke` | `{reason}` | 204 |
| POST | `/api/v1/providers/{id}/keys/{keyId}/rotate` | `{label?}` | 201 new `IssuedKey`. Old key stays ACTIVE until revoked (decision 6) |

- [ ] Add `status`, `disabledAt` and `activeKeys` to `ProviderView`. `lastCallbackAt` exists already.
- [ ] A `PATCH` to `DISABLED` must evict nothing. The filter reads status uncached (Task 2).
- [ ] Write the ITs: viewer gets 403 on every write; create/disable/enable round trip; list keys never contains `secret`.
- [ ] Update `docs/API_DOCUMENTATION.md` ("Providers and AI models" stops being read-only), `docs/samples/*.json` and
  `core/models.ts` together, as AGENTS.override requires.

### Task 5 (if decision 5 = yes): Admin result entry

**Files:** Modify `match/MatchResultService.java` (new `applyAdmin(UUID matchId, ResultRequest r, UUID actor)`, sharing
`merged`/history logic with `change_source='ADMIN'`, `changed_by=actor`) and `match/MatchController.java`.

- [ ] Add `PUT /api/v1/matches/{id}/result`. Write ITs for stale-result 409, history row `ADMIN`, and auto-settle on FINISHED.

### Task 6: Providers screen (UX-019) + prompt copy

**Files:**
- Create `matchmind-web/src/app/pages/providers.ts`.
- Modify `app.routes.ts` (`providers`, admin write actions hidden for VIEWER), `core/api.service.ts`, `core/models.ts`,
  `layout/shell.ts` (nav), `pages/prompts.ts`.

- [ ] Table columns: code, name, status, models, predictions, active keys, last callback (`—` when null). Row actions:
  Edit, Enable/Disable (confirm + reason), Keys.
- [ ] Keys dialog (`shared/kit.ts` dialog):
  - It lists keys and offers Issue/Rotate/Revoke.
  - Issue shows the key once in a read-only input with Copy and the warning "You will not see this key again".
  - It offers "Copy prompt with this key". That button replaces `{{EXTERNAL_API_KEY}}` client-side and never sends the key back.
- [ ] `PromptController.forAgent` substitutes the shared key only while legacy mode is on. Otherwise it leaves the
  placeholder and the UI explains why.
- [ ] Write the unit spec `providers.spec.ts`: secret shown once and cleared on dialog close; viewer sees no actions.
- [ ] Verify with `npx ng test --watch=false && npx ng build`.

### Rollout / rollback

1. Deploy with `EXTERNAL_API_KEY` still set. Legacy behaviour is unchanged, and new keys work alongside it.
2. The admin creates or claims each provider, issues keys, and updates each agent's prompt or Action config.
3. Watch API Logs for `legacyKey=true` rows to reach zero.
4. Unset `EXTERNAL_API_KEY` and restart.

Rollback:
- Re-set `EXTERNAL_API_KEY`. The legacy path comes back with no data change.
- The migration is additive, so no down-migration is needed.

Effort: **L** (about 4–5 days: API 2.5, UI 1.5, docs/E2E 1).
