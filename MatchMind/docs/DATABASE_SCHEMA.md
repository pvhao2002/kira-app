# MatchMind database schema

PostgreSQL 17, database `matchmind_db`. Flyway applies migrations from
`matchmind-api/src/main/resources/db/migration` when the API starts.

| Migration | Content |
|---|---|
| `V1__core_schema.sql` | All tables, constraints and indexes below |
| `V2__default_prompt_templates.sql` | Seeds the "AI Football Prediction Prompt" and "AI Settlement Calculation Prompt" templates |

Rules for changes: migrations are append-only. Never edit an applied migration; add `V3__...` instead.
Enumerations are `VARCHAR` + `CHECK`, so a new value is an additive migration that replaces the check.

## Conventions

- Primary keys are `UUID` (`gen_random_uuid()`).
- Every timestamp is `TIMESTAMPTZ`. The API always reads and writes UTC.
- Odds, lines and probabilities are `NUMERIC`, never floating point.
- Flexible or provider-specific data is `JSONB`: raw payloads, extra stats, simulation output and settlement details.
- Home and away values are stored as pairs. A pair is either fully present or fully `NULL`, enforced by `ck_*_pair`
  checks. A missing score is never stored as a fake `0`.
- Prediction data is immutable after ingestion. JPA maps those entities as `@Immutable`, and V23 enforces it in the
  database (see "Immutability triggers").

## Entity overview

```
users ──< provider_api_keys.created_by, match_result_history.changed_by, prediction_pick_results.created_by
providers ──< provider_api_keys
          ──< ai_models ──────────┐
          ──< matches ──────────┐ │   (composite FKs keep all three on the same provider)
          ──< predictions >─────┘─┘
predictions ──< prediction_odds ──< prediction_picks ──< prediction_pick_results (append-only)
            ──1 prediction_stats
            ──1 prediction_simulations
            ──< prediction_correct_scores
matches ──< match_result_history
external_api_requests (audit of every external call; optional FK to providers / provider_api_keys)
prompt_templates
```

## Tables

### users
Dashboard accounts. There is no public sign-up. The first admin is created from environment variables when the table is
empty. Admins create every other account.

| Column | Type | Notes |
|---|---|---|
| username | VARCHAR(64) | Unique, case-insensitive (`ux_users_username` on `lower(username)`) |
| password_hash | VARCHAR(100) | BCrypt, cost 12 |
| role | VARCHAR(16) | `ADMIN` or `VIEWER` |
| status | VARCHAR(16) | `ACTIVE` or `DISABLED` |
| token_version | INTEGER | Copied into every JWT as claim `tv`. Bumped on logout-all, password change, reset and disable, which revokes all older tokens |
| must_change_password | BOOLEAN | V19. Set by an admin on create/reset; every call except `me`, change-password and logout is `403 PASSWORD_CHANGE_REQUIRED` until the user changes it |
| last_login_at, created_at, updated_at | TIMESTAMPTZ | |

### user_audit (V19)
Who changed which account: `actor_id`/`actor_username`, `target_id`/`target_username`, `action` (`USER_CREATED`,
`ROLE_CHANGED`, `STATUS_CHANGED`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `LOGIN_UNLOCKED`), `old_value`, `new_value`,
`client_ip`, `at`. No FK to `users`, so history outlives the account.

### revoked_tokens (V21)
`jti` (PK) and `expires_at`. `POST /auth/logout` revokes only the current token's `jti`; rows can be purged once
`expires_at` has passed.

### providers / provider_api_keys
A provider is an AI agent that sends callbacks. It is created on its first call from the `X-Provider` header
(`code` = `name` = the lower-cased header). All agents authenticate with one shared key from `EXTERNAL_API_KEY`.

| Column | Notes |
|---|---|
| providers.code | `^[a-z0-9][a-z0-9_-]{1,63}$`, unique, immutable |
| providers.status | Always `ACTIVE` now; nothing changes it |
| provider_api_keys | Unused since the shared key replaced per-provider keys. Kept because migrations are additive; old audit rows still reference it through `external_api_requests.api_key_id` (null for new rows) |

### ai_models
Created per provider on first use (`X-Model-Name` / `X-Model-Version`, else `model` in the body) with
`INSERT … ON CONFLICT DO NOTHING`. `(provider_id, name, version)` is unique. V14 adds `ux_ai_models_provider_identity`
on the provider, `lower(name)` and the normalised version (`1` = `1.0`; names are trimmed before insert), so names match
case-insensitively and the first spelling is kept (skipped with a NOTICE if existing rows already collide). `status` is always `ACTIVE` now.
`ux_ai_models_id_provider (id, provider_id)` exists only as the target of a composite FK.

### matches
One row per provider and external match: `ux_matches_provider_external (provider_id, external_match_id)`.

| Column | Notes |
|---|---|
| status | `SCHEDULED`, `LIVE`, `FINISHED`, `CANCELLED`, `POSTPONED`. Predictions may only set `SCHEDULED`/`LIVE`. Terminal states come from the results API |
| final_*, ht_* scores and corners | SMALLINT pairs. `ck_matches_finished_has_score`: a `FINISHED` match has a final score. `ck_matches_ht_le_ft`: the half-time score is not above the full-time score |
| result_updated_at | Timestamp of the result currently applied. Older provider results are rejected as `409 STALE_RESULT`; a stored time more than 5 minutes in the future never blocks a later result, and admin entries (`POST /matches/{id}/result`) never get `STALE_RESULT` |

Indexes: `start_time DESC`, `league`, `status`.

### match_result_history
Append-only record of every result change: `previous_result` and `new_result` as JSONB, `change_source` (`PROVIDER` or
`ADMIN`), and `source_request_id` pointing to the audited external request. Admin rows carry `changed_by` and the
username and `reason` inside `new_result`. A kick-off change (reschedule, POSTPONED back to SCHEDULED) is also recorded
as a `{startTime, status}` pair.

### predictions
One immutable snapshot per callback.

| Column | Notes |
|---|---|
| external_event_id | Idempotency key. `ux_predictions_provider_event (provider_id, external_event_id)` |
| payload / payload_hash | Exact accepted request body (JSONB) and the SHA-256 of its canonical form (sorted keys). The same event id with the same hash is a duplicate (200). A different hash is `409 EVENT_ID_REUSED` |
| prediction_type | `PRE_MATCH` or `LIVE`. `ck_predictions_live_snapshot`: LIVE requires `match_minute` and the current score |
| match_minute, current_* | Match state when the prediction was made |
| metadata | Free provider JSONB |

Composite foreign keys `fk_predictions_match (match_id, provider_id)` and `fk_predictions_model (ai_model_id,
provider_id)` make it impossible to attach a prediction to another provider's match or model.

Indexes: `(match_id, predicted_at DESC)`, `(ai_model_id, predicted_at DESC)`, `predicted_at DESC`.

### prediction_odds
Every odds snapshot sent with a prediction (opening, pre-match and live; several per market).

| Column | Notes |
|---|---|
| odds_ref | Provider-chosen reference, unique per prediction. Picks point to it |
| market | `1X2`, `AH`, `OU`, `CORNER_AH`, `CORNER_OU` |
| odds_stage, snapshot_order | `OPENING`, `PRE_MATCH` or `LIVE`, and the order within that stage |
| line / line_display | NUMERIC(6,2). `ck_prediction_odds_line`: `NULL` for 1X2, otherwise a multiple of 0.25 (quarter lines). AH lines are quoted for the **home** side. OU lines are ≥ 0 |
| home/draw/away/over/under_odds | NUMERIC(8,3) > 1. `ck_prediction_odds_prices` requires exactly the prices the market needs |
| settlement_basis | `FULL_MATCH` or `REMAINING_MATCH`. `ck_prediction_odds_remaining_basis`: REMAINING_MATCH needs the score (or corners for corner markets) at capture |
| *_score_at_capture, *_corners_at_capture, captured_at | Live capture state |
| extra | JSONB |

`ux_prediction_odds_id_prediction_market (id, prediction_id, market)` is the target of the pick FK.

### prediction_picks
The AI's selections, ranked.

| Column | Notes |
|---|---|
| odds_id | Composite FK `(odds_id, prediction_id, market)`. A pick can only reference odds of the same prediction and the same market |
| pick | `ck_prediction_picks_side`: `HOME/DRAW/AWAY` for 1X2, `HOME/AWAY` for AH markets, `OVER/UNDER` for totals |
| probability | NUMERIC(7,6), between 0 and 1 |
| pick_rank | Unique per prediction |

### prediction_stats / prediction_simulations / prediction_correct_scores
- `prediction_stats` (0..1 per prediction): possession, shots, shots on/off target, corners, yellow and red cards, plus
  `extra` JSONB.
- `prediction_simulations` (0..1 per prediction): method, `simulation_count`, `random_seed`, expected remaining goals and
  corners, `algorithm_version`, and JSONB `parameters`, `probabilities` and `correct_score_distribution`.
- `prediction_correct_scores`: ranked predicted scorelines with probability.

### prediction_pick_results (append-only settlement history)
| Column | Notes |
|---|---|
| result | `WIN`, `LOSS`, `HALF_WIN`, `HALF_LOSS`, `PUSH`, `VOID`, `PENDING` |
| details | JSONB calculation trace: basis, scores used, line split for quarter lines, and any advisory `aiCalculation` |
| source | `AUTO`, `EXTERNAL_REQUEST`, `ADMIN_SETTLEMENT`, `ADMIN_RECALCULATION`, `ADMIN_OVERRIDE` |
| calculation_version | Engine version, e.g. `settle-v1` |
| is_current / superseded_at / superseded_by | `ux_prediction_pick_results_current` is a partial unique index allowing one current row per pick. A recalculation or override marks the old row superseded and inserts a new one. Rows are never updated otherwise or deleted |
| reason, created_by | Required reason and acting admin for manual changes |

A pick with no current row is **pending**. The read side reports it as `PENDING`. No placeholder row is written.

### external_api_requests
Audit row for every call to `/api/v1/external/**`, including rejected ones. It stores the outcome (`SUCCESS`,
`DUPLICATE`, `REJECTED`, `FAILED`), HTTP status, duration, client IP, request id, event id, and a `processing_result`
JSONB summary. **Request bodies, API keys and headers are never stored here.** The accepted prediction body is stored
only in `predictions.payload`. V20 adds `actor`: the signed-in admin behind an import, settle, recalculate or override
(NULL for agent calls). Bad-key calls are sampled to one row per IP per minute.

### prompt_templates
Editable AI prompt notes. `name` is unique. `template_type` matches `^[A-Z][A-Z0-9_]{1,63}$`. `version` starts at 1 and
increases on each save. Saves use optimistic concurrency: the client sends `expectedVersion`, and a mismatch returns
`409 PROMPT_VERSION_CONFLICT`. Templates name the API as `{{API_BASE_URL}}` (V17), filled from `PUBLIC_BASE_URL` or the
request origin.

### prompt_template_versions (V16)
Append-only copy of every saved version: `template_id`, `version` (unique together), `content`, `description`,
`active`, `updated_by`, `created_at`. Trigger `tr_prompt_templates_version` writes a row on insert and on every
`version` bump; `tr_prompt_template_versions_append_only` rejects `UPDATE` and `DELETE`. Restore saves an old version's
content as a new version.

### Archive, rename and merge (V24)
- `providers`, `ai_models` and `matches` get `archived_at TIMESTAMPTZ` (NULL = visible) and a partial index
  `ix_<table>_active ... WHERE archived_at IS NULL`. Nothing is deleted.
- `ai_models.display_name` (nullable) overrides the shown name; `(name, version)` identity is untouched.
- `ai_models.merged_into_id` points at the surviving model of the same provider: composite FK
  `fk_ai_models_merged_into (merged_into_id, provider_id) -> ai_models (id, provider_id)` plus
  `ck_ai_models_not_self_merged`. Trigger `trg_ai_models_no_chain` (function `mm_ai_models_no_chain`, `BEFORE INSERT OR
  UPDATE OF merged_into_id`) raises `P0001` `MM_MODEL_MERGE_CHAIN: <id>` when the target is itself merged, or when other
  models already merge into the row being merged. The trigger takes `pg_advisory_xact_lock(hashtext('mm_model_merge'), hashtext(provider_id))` first, so concurrent merges of one provider serialise. Re-pointing A->B to A->C is application logic.
- `admin_actions` (append-only, V23 triggers): `entity` (`PROVIDER|MODEL|MATCH`), `entity_id`, `action`
  (`ARCHIVE|UNARCHIVE|RENAME|MERGE|UNMERGE`), `reason` (not blank), `actor`, `at`, `details` JSONB; index `(entity, entity_id, at DESC)`.

## Search folding (V22)
`mm_fold(text)` = lower-case + `unaccent` + NFC, `IMMUTABLE`. Search and the league filter compare `mm_fold` on both
sides, so "atletico" finds "Atlético". No index yet: a leading-wildcard `LIKE` cannot use a btree; a `pg_trgm` GIN index
on `mm_fold(...)` is the upgrade if search gets slow.

## Immutability triggers (V23)
`BEFORE UPDATE OR DELETE` row triggers plus a `BEFORE TRUNCATE` statement trigger raise `SQLSTATE P0001` with message
`MM_IMMUTABLE: <table>`. They fire for superusers and the table owner too.

- Immutable (`trg_<table>_immutable`, function `mm_forbid_change`): `predictions`, `prediction_odds`, `prediction_stats`,
  `prediction_simulations`, `prediction_picks`, `prediction_correct_scores`, `match_result_history`.
- Supersede only (`trg_prediction_pick_results_supersede_only`): the one legal update is `is_current` true→false,
  `superseded_at` NULL→ts and `superseded_by` NULL→id, each once. Every other column is frozen; delete is rejected.
- Not protected: `external_api_requests` (retention purges it), and the mutable tables.

A violation is a bug: the API returns `500 INTERNAL_ERROR` and logs the table name only. A deliberate data fix is a
reviewed migration that does `ALTER TABLE … DISABLE TRIGGER …`, the fix, then `ENABLE TRIGGER …`. A new immutable or
append-only table adds its own triggers in the migration that creates it.

## Read-side aggregation

Reports use SQL aggregation (`NamedParameterJdbcTemplate`) over these tables and join the current settlement row
(`is_current`). The win rate is `(WIN + HALF_WIN) / (WIN + HALF_WIN + LOSS + HALF_LOSS)`. Push, void and pending picks
are excluded from the denominator.
