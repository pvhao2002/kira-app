# DB-level immutability and append-only (UX-088)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans.
> Migration numbers are `V<next>`.

## Problem

- `information_schema.triggers` is empty.
- The runtime role `matchmind` has `UPDATE`/`DELETE` on `predictions` and `prediction_pick_results`. In compose it is also
  the `POSTGRES_USER`, so it is a **superuser** and the owner of every table.
- Immutability is only JPA `@Immutable`, and append-only is only `@Column(updatable=false)` on `PickResult`. Raw JDBC, a
  migration or an ops script can rewrite snapshots or delete settlement history. A reviewer did exactly that in UX-084.

## Options

| | Option | Trade-off |
|---|---|---|
| A | **Triggers now (`BEFORE UPDATE OR DELETE` + `BEFORE TRUNCATE`), role split later as phase 2 (recommended).** | Works with today's single superuser role, Flyway and Testcontainers unchanged. Triggers fire for superusers too. Limit: the table owner can still `ALTER TABLE … DISABLE TRIGGER`. That is deliberate and visible, never accidental. |
| B | Role split only: `matchmind_owner` runs Flyway, `matchmind_app` runs the app with `REVOKE UPDATE, DELETE`. | Real privilege boundary. But a column-level `GRANT UPDATE (is_current, superseded_at, superseded_by)` cannot express "only true→false". An existing prod volume needs a manual role bootstrap (the docker init script runs only on an empty volume), and it needs a second secret. |
| C | Both at once. | Most robust. Ops cost lands on the same release. |

**Recommendation: A in this release, B as a separate follow-up (Task 4).** Triggers carry the precise rule (supersede
transition only). Grants then become defence in depth.

## Decisions needed from the owner

1. **Role split (phase 2).** Approve a second DB credential: `DB_APP_USERNAME/DB_APP_PASSWORD` for runtime, with the
   existing `DB_USERNAME` used by Flyway only. Also approve a one-off manual SQL step on the existing prod database.
2. **Ops escape hatch.** Recommended: none in code. A data fix is a reviewed `V<n>__fix_*.sql` that does
   `ALTER TABLE … DISABLE TRIGGER …; …; ENABLE TRIGGER …` in the same migration, so it is visible in git. Alternative: a
   session GUC (`SET matchmind.allow_snapshot_write='on'`) checked by the trigger. Rejected by default, because any app
   code could set it.
3. **Scope.** Which tables, beyond the obvious ones?
   - Recommended immutable: `predictions`, `prediction_odds`, `prediction_stats`, `prediction_simulations`,
     `prediction_picks`, `prediction_correct_scores`.
   - Recommended append-only: `match_result_history`, `prediction_pick_results` (supersede only), and
     `fixture_link_history` if the fixtures plan lands.
   - `external_api_requests` is **excluded**, because `ApiLogRetention.purge` deletes old rows on purpose.
4. **Error surface.** A trigger violation is a bug, never a user error. Recommended: `SQLSTATE 'P0001'` with message
   `MM_IMMUTABLE: <table>`. The handler maps it to `500 INTERNAL_ERROR` and logs the table name only (no row data).

## Blast radius (GitNexus, upstream)

| Symbol | Risk | Notes |
|---|---|---|
| `SettlementService` | LOW | Its callers are `ExternalController`, `MatchResultService` and `SettlementController`. `replace(...)` is the **only** code path that updates `prediction_pick_results` |
| `PickResult` entity | **CRITICAL** (graph count of about 991 is inflated by same-name classes in other modules; 2 direct in MatchMind) | No Java change planned. The trigger must accept exactly what `replace` emits today |
| `Prediction` entity | **CRITICAL** (inflated the same way, 2 direct) | No Java change |

Text search for writes: `grep -rn "UPDATE\|DELETE" matchmind-api/src` hits only `SettlementService.replace` (via JPA),
`ApiLogRetention` (audit table) and test fixtures that update `matches`, which is mutable and unaffected.

**What `replace` emits (must stay legal).** Hibernate writes all updatable columns:
1. `saveAndFlush(old)`: `is_current true→false`, `superseded_at NULL→ts`, `superseded_by` unchanged (NULL).
2. At commit, the dirty `old.setSupersededBy(created.id)`: `superseded_by NULL→id`, everything else unchanged.

## Global constraints

- Migration only. No Java change except the exception mapping and new ITs.
- Triggers are `BEFORE ... FOR EACH ROW`, plus a statement-level `BEFORE TRUNCATE`.
- Functions are `plpgsql` with `SET search_path = pg_catalog, public`.

## Review Focus

1. `SettlementService.recalculate`, `override`, and the "reopened" path of `settleMatch` still work. Both updates of
   `replace` pass.
2. `UPDATE prediction_pick_results SET result='WIN'` fails, even on the current row.
3. A second supersede of an already superseded row (`superseded_by` changes from one id to another) fails.
4. `DELETE` and `TRUNCATE` on every protected table fail, including as a superuser (the Testcontainers user is a superuser).
5. Flyway on a fresh DB and on a DB at V13 both apply cleanly. `ON DELETE` cascades don't exist today, so no FK action
   trips a trigger. Re-check if one is added.

---

### Task 1: Migration `V<next>__immutable_snapshots.sql`

**Files:** Create `matchmind-api/src/main/resources/db/migration/V<next>__immutable_snapshots.sql`.

- [ ] Generic guard:
  ```sql
  CREATE FUNCTION mm_forbid_change() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
  BEGIN RAISE EXCEPTION 'MM_IMMUTABLE: %', TG_TABLE_NAME USING ERRCODE = 'P0001'; END $$;
  ```
- [ ] For each immutable table T (decision 3):
  `CREATE TRIGGER trg_<T>_immutable BEFORE UPDATE OR DELETE ON T FOR EACH ROW EXECUTE FUNCTION mm_forbid_change();`
  and `CREATE TRIGGER trg_<T>_no_truncate BEFORE TRUNCATE ON T FOR EACH STATEMENT EXECUTE FUNCTION mm_forbid_change();`
- [ ] Apply the same to `match_result_history`.
- [ ] Supersede-only guard for `prediction_pick_results` (the algorithm the tests do not determine):
  ```sql
  CREATE FUNCTION mm_pick_result_supersede_only() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
  BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'MM_IMMUTABLE: %', TG_TABLE_NAME USING ERRCODE = 'P0001'; END IF;
    IF (NEW.id, NEW.pick_id, NEW.result, NEW.settled_at, NEW.details, NEW.source, NEW.calculation_version, NEW.reason, NEW.created_by)
       IS DISTINCT FROM
       (OLD.id, OLD.pick_id, OLD.result, OLD.settled_at, OLD.details, OLD.source, OLD.calculation_version, OLD.reason, OLD.created_by)
       OR (NEW.is_current AND NOT OLD.is_current)                                   -- never revive
       OR (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at)
       OR (OLD.superseded_by IS NOT NULL AND NEW.superseded_by IS DISTINCT FROM OLD.superseded_by)
    THEN RAISE EXCEPTION 'MM_IMMUTABLE: %', TG_TABLE_NAME USING ERRCODE = 'P0001'; END IF;
    RETURN NEW;
  END $$;
  ```
  The existing `ck_prediction_pick_results_current` already ties `is_current` to `superseded_at`.
- [ ] Add the no-truncate trigger on `prediction_pick_results`.

### Task 2: Map the error

**Files:** Modify `shared/GlobalExceptionHandler.java`.

- [ ] When an `UncategorizedSQLException`/`DataAccessException` has a root `PSQLException` with SQLState `P0001` and a
  message starting `MM_IMMUTABLE`, return 500 `INTERNAL_ERROR`.
- [ ] Log `"immutable table write blocked: {table}"`, nothing else. The standard error shape is unchanged.

### Task 3: ITs

**Files:** Create `matchmind-api/src/test/java/com/matchmind/it/DbIntegrityIT.java`. It extends `IntegrationTestBase`, uses
`db` (JdbcTemplate), and seeds through the external API with `Payloads`.

- [ ] Write these tests:
  - `updatePredictionIsRejected`: `assertThatThrownBy(() -> db.update("UPDATE predictions SET predicted_at = now() WHERE id = ?", id)).hasMessageContaining("MM_IMMUTABLE")`.
  - `deleteFromEachSnapshotTableIsRejected`: a parameterised loop over the 6 tables plus `match_result_history`.
  - `truncateIsRejected`
  - `pickResultResultColumnIsFrozen`
  - `pickResultCannotBeRevived`
  - `pickResultSupersededByCannotChangeTwice`
  - `recalculateAndOverrideStillSupersede`: through the admin API, then assert 2 rows, 1 current, `superseded_by` set.
  - `triggersExist`: `SELECT count(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trg_%_immutable'` ≥ 7.
- [ ] Verify the full suite with `cd MatchMind/matchmind-api && mvn -B verify` (Docker needed). The existing settlement ITs
  are the regression net.

### Task 4 (phase 2, after decision 1): Role split

**Files:** `application.yml` (`spring.flyway.user/password` = owner; datasource = app role), `docker-compose.yml`,
`.env.example`, new `MatchMind/db/init/10-app-role.sh` (mounted to `/docker-entrypoint-initdb.d`), migration
`V<next>__app_role_grants.sql`, `IntegrationTestBase` (`withInitScript` creating `matchmind_app`; datasource as app,
Flyway as `test`).

- [ ] The migration grants only, with no role creation, because a password must not be in git:
  - Guard the body with `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='matchmind_app') THEN … END IF; END $$`.
  - `GRANT SELECT, INSERT ON <immutable + append-only tables>`.
  - `GRANT UPDATE (is_current, superseded_at, superseded_by) ON prediction_pick_results`.
  - `GRANT SELECT, INSERT, UPDATE, DELETE` on the mutable tables (`matches`, `users`, `providers`, `ai_models`,
    `prompt_templates`, `provider_api_keys`, `external_api_requests`).
  - `ALTER DEFAULT PRIVILEGES FOR ROLE <owner> GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO matchmind_app`.
- [ ] Add a rule to AGENTS.override: a new immutable table must `REVOKE UPDATE, DELETE` in its own migration.
- [ ] Write the IT `appRoleHasNoDeleteOnSnapshots`. It uses `has_table_privilege('matchmind_app', 'predictions', 'DELETE')`,
  which must be false.
- [ ] Runbook for the existing prod volume:
  1. Run `CREATE ROLE matchmind_app LOGIN PASSWORD '…'` once.
  2. Set the env vars.
  3. Restart. Flyway runs the grants because the role now exists.
  4. The grant migration is guarded, so environments without the role are unaffected, but they also get no protection
     from grants. The triggers still protect them.

### Rollout / rollback

- Phase 1: deploy. Flyway adds the triggers.
- Rollback: a new migration `V<n>__drop_immutable_triggers.sql`. Never edit the applied one. No data is touched.
- Phase 2 rollback: point the datasource back at the owner credential.

Effort: **M** for phase 1 (about 1.5 days). Phase 2 is **M** (about 2 days including the runbook and IT changes).
