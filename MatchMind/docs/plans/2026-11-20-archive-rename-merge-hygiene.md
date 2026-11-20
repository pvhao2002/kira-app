# Archive, model rename/merge, E2E data hygiene, user status filter (UX-002 + UX-108 rename/merge part)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans.
> Migration numbers are `V<next>`.

## Problem

- The stack holds 28 "E2E Model …" rows, 29 providers, 35 matches and about 20 active `viewer-…` accounts. They come from
  `matchmind-web/e2e/journeys.spec.ts`, which creates `e2e-<run>` providers, models and viewers on every run and never
  cleans up.
- Every filter dropdown and report shows this data. Nothing can be hidden. The only lever today is disabling a user.
- Model names are case and punctuation sensitive (UX-108). `gpt-5.1`, `GPT-5.1`, `GPT 5.1` and `gpt-5.1-` are 4 models with
  split win rates, and they can be neither renamed nor merged.
- Constraint: deleting is not an option. `predictions` are immutable and `prediction_pick_results` are append-only (and
  protected by DB triggers once UX-088 lands). Composite FKs pin predictions to their provider's model.

Out of scope: the normalised model key at ingest (UX-108 "S" part) and the `"1"` vs `"1.0"` version duplicates (UX-017).
Those belong to other lanes. This plan reuses their normaliser if it exists.

## Options

**Hiding data**

| | Option | Trade-off |
|---|---|---|
| A | **`archived_at TIMESTAMPTZ` on `providers`, `ai_models`, `matches`. Hidden by default in lists, filters and reports, with `includeArchived=true` to show (recommended).** | Additive and reversible. No snapshot touched. Cost: one predicate in `Filters.where` and the list queries. |
| B | Reuse `status = 'DISABLED'`. | `providers.status=DISABLED` will mean "reject callbacks" (per-provider-keys plan). Mixing "hidden" with "blocked" makes it impossible to hide an active test agent. |
| C | Hard delete (cascade). | Violates immutability and append-only, and destroys the audit trail. **Rejected.** |

**Model rename/merge**

| | Option | Trade-off |
|---|---|---|
| A | **Rename = `ai_models.display_name` (nullable). Merge = `ai_models.merged_into_id` with a composite self-FK `(merged_into_id, provider_id) → ai_models (id, provider_id)`. Reports resolve the effective model `COALESCE(merged_into_id, id)` (recommended).** | Predictions keep their original `ai_model_id`, so nothing immutable changes. The same-provider rule is enforced in the DB. Unmerge is `merged_into_id = NULL`. Cost: every report join resolves the effective model. |
| B | Re-point `predictions.ai_model_id`. | Rewrites immutable snapshots. **Rejected.** |
| C | Alias table `(provider, name, version) → model`. | Fixes future ingests only. History stays split. |

**E2E hygiene**

| | Option | Trade-off |
|---|---|---|
| A | **E2E runs against its own throw-away compose project (tmpfs DB). As a fallback, when run against a shared stack, `afterAll` archives the run's provider and disables the run's viewer (recommended).** | A clean shared DB, at the cost of a few extra minutes for an image build per run. The fallback needs no delete API. |
| B | Cleanup only (archive + disable). | Rows still accumulate, only hidden. |

## Decisions needed from the owner

1. **Should archive cascade?** Recommended: archiving a provider hides its models and matches through the filter (no
   writes to children). Archiving a match hides it everywhere, including win rates. Should archived *matches* still count
   in model win rates? Recommended: no, because hidden means hidden. An explicit `includeArchived=true` restores it.
2. **Ingest into archived things.** Recommended: an archived provider, model or match still accepts callbacks, and the
   data stays hidden. Blocking is the provider `DISABLED` flag. Alternatively, a callback could auto-unarchive.
3. **Merge scope.** Merge only within one provider (DB-enforced)? Recommended: yes. Cross-provider "same model" is a
   different concept (fixtures-like). Not now.
4. **After a merge, where do new ingests of the source name go?** Recommended: to the target. Ingest follows
   `merged_into_id`, so the agent's old spelling keeps feeding the merged model. After unmerge, those post-merge
   predictions stay on the target (documented).
5. **"Disable all" users button.** Recommended: no bulk action. A status filter plus per-row Disable is enough. Bulk
   disable is risky (it can disable the admin's own peers).
6. **E2E stack.** Approve a separate `docker-compose.e2e.yml` (project `matchmind-e2e`, web on `:8188`, DB on `tmpfs`) and
   an npm script `e2e:stack`.

## Blast radius (GitNexus, upstream)

| Symbol | Risk | Notes |
|---|---|---|
| `AiModelService` | LOW | `AiModelController` |
| `AiModelRepository` | LOW | `PredictionIngestionService`, `PredictionQueryService`, `ExternalController` |
| `PredictionIngestionService` (private `model(...)`) | LOW | `ExternalController` |
| `AuthService` | LOW | `AuthController` |
| `Filters` | graph result is noisy (name collides with web files). Treat as **HIGH** by usage | Text search: every report method in `ReportService`, `PredictionQueryService.list`, `ReportService.dashboard` (`new Filters(...)` with 10 positional args: **must be updated** when the record gains a component), and the controllers binding it from query params |
| `ReportService`, `MatchQueryService` | UNKNOWN (no callers resolved) | Text search: `ReportController`, `MatchController` |

## Global constraints

- No UPDATE/DELETE of snapshot or settlement rows. Archive, rename and merge write only `providers`, `ai_models` and
  `matches` (mutable tables).
- Every admin action needs a reason and is recorded. Recommended: reuse a small append-only table
  `admin_actions(entity, entity_id, action, reason, actor, at, details JSONB)`. Skip it only if the owner accepts
  `updated_at` as enough.
- Reports keep SQL aggregation. The effective-model join is a single shared fragment in `shared/Sql.java`.

## Review Focus

1. `?modelId=<archived model>` still returns that model's data. An explicit id wins over the default hide.
2. A merge chain cannot form. A→B then B→C re-points A to C in the same transaction, and a trigger rejects a direct
   2-level chain.
3. After merging A into B, B's win rate equals the sum of A and B, and A disappears from the model list and dropdowns.
   Unmerge restores both exactly.
4. The dashboard's `totalModels` excludes archived and merged models.
5. A viewer cannot archive, rename or merge (403). The admin cannot disable themself (the existing `demotesSelf` guard
   stays).

---

### Task 1: Migration `V<next>__archive_and_model_merge.sql`

**Files:** Create `matchmind-api/src/main/resources/db/migration/V<next>__archive_and_model_merge.sql`.

- [ ] Add `archived_at TIMESTAMPTZ` to `providers`, `ai_models` and `matches`, each with a partial index
  `WHERE archived_at IS NULL`.
- [ ] Add `ai_models.display_name VARCHAR(128)` and `ai_models.merged_into_id UUID`, with:
  - `CONSTRAINT fk_ai_models_merged_into FOREIGN KEY (merged_into_id, provider_id) REFERENCES ai_models (id, provider_id)`
  - `CHECK (merged_into_id <> id)`
- [ ] Trigger `mm_ai_models_no_chain` `BEFORE INSERT OR UPDATE OF merged_into_id`. It raises when the target has its own
  `merged_into_id`, or when another row already merges into `NEW.id` while `NEW.merged_into_id` is set.
- [ ] Optional `admin_actions` table (see the global constraints).

### Task 2: Effective model + archive filter

**Files:** Modify `shared/Sql.java`, `shared/Filters.java`, `report/ReportService.java`,
`prediction/PredictionQueryService.java`, `match/MatchQueryService.java`, `model/AiModelService.java`. Test:
`it/ArchiveMergeIT.java`.

**Interfaces:**
- `Sql.EFFECTIVE_MODEL_JOIN = " JOIN ai_models am0 ON am0.id = p.ai_model_id JOIN ai_models am ON am.id = COALESCE(am0.merged_into_id, am0.id) "`.
  It replaces `JOIN ai_models am ON am.id = p.ai_model_id` in `PICKS_FROM`, `MC_FROM`, `modelComparison` and the dashboard.
- The display name is `COALESCE(am.display_name, am.name)` as `"modelName"`. The raw `name` stays as `"modelKey"` where
  shown.
- `Filters` gains `Boolean includeArchived` as the last component. Update `ReportService.dashboard`'s `new Filters(...)`.
- `Filters.where`:
  - `modelId` becomes `p.ai_model_id IN (SELECT id FROM ai_models WHERE id = :modelId OR merged_into_id = :modelId)`.
  - Unless `includeArchived` is true or an explicit `modelId`/`providerId`/`matchId` is given, it appends
    `m.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM ai_models x WHERE x.id IN (p.ai_model_id, (SELECT merged_into_id FROM ai_models y WHERE y.id = p.ai_model_id)) AND x.archived_at IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM providers x WHERE x.id = p.provider_id AND x.archived_at IS NOT NULL)`.
- `AiModelService.list(providerId, includeArchived)` hides merged and archived models by default. Win-rate subqueries use
  `pr.ai_model_id IN (m.id, merged children)`.
- The same default applies to `ProviderService.list`, `MatchQueryService` list and leagues (evict the `LEAGUES` cache on
  archive).

- [ ] ITs:
  - `archivedProviderHiddenFromReportsAndDropdowns`
  - `explicitModelIdShowsArchived`
  - `mergeSumsWinRate`
  - `unmergeRestores`
  - `mergeChainIsRejectedByDb` (raw SQL)
  - `crossProviderMergeIsRejectedByDb` (FK)

### Task 3: Ingest follows merges

**Files:** Modify `prediction/PredictionIngestionService.java` (`model(...)`) and `model/AiModel.java` (`mergedIntoId`,
`displayName`, `archivedAt`).

- [ ] Write the IT `ingestOfMergedSourceLandsOnTarget`.
- [ ] When the found model has `mergedIntoId`, use the target's id. The composite FK still holds, because the target is
  the same provider.

### Task 4: Admin API

**Files:** `model/AiModelController.java`, `provider/ProviderController.java`, `match/MatchController.java`,
`security/AuthController.java` + `AuthService.list(String status)`.

| Method | Path | Body |
|---|---|---|
| POST | `/api/v1/{providers,models,matches}/{id}/archive` | `{reason}` |
| POST | `/api/v1/{providers,models,matches}/{id}/unarchive` | `{reason}` |
| PATCH | `/api/v1/models/{id}` | `{displayName}` (blank = clear) |
| POST | `/api/v1/models/{id}/merge` | `{targetModelId, reason}`. `409 MODEL_MERGE_CROSS_PROVIDER` / `MODEL_ALREADY_MERGED` |
| POST | `/api/v1/models/{id}/unmerge` | `{reason}` |
| GET | `/api/v1/users?status=ACTIVE\|DISABLED` | |
| GET | list endpoints | `?includeArchived=true` |

- [ ] ITs: viewer gets 403 on each write; a missing reason is 400; `GET /users?status=DISABLED` returns only disabled
  users.
- [ ] Update `docs/API_DOCUMENTATION.md`, `core/models.ts` and samples.

### Task 5: UI

**Files:** `pages/models.ts` and `pages/model-detail.ts` (Rename, Merge into… with a select of same-provider models,
Archive; a "Show archived" toggle), the Providers screen (Archive, from the per-provider-keys plan; until it lands,
add an Archive action on the provider column of `models.ts`), `pages/matches.ts` (Archive), `pages/settings.ts` (status
filter `<select>` All/Active/Disabled), `shared/filter-bar` (dropdowns call the default lists, so archived entries vanish).

- [ ] Specs: a merged model shows "merged into X"; the archive toggle refetches with `includeArchived=true`; the status
  filter sends `?status=`.

### Task 6: E2E hygiene

**Files:**
- Create `MatchMind/docker-compose.e2e.yml`.
- Modify `matchmind-web/e2e/journeys.spec.ts` (`test.afterAll`: archive provider `e2e-<run>` with reason
  `"e2e cleanup"` and disable `viewer-<run>`) and `matchmind-web/package.json` (`e2e:stack` script).

- [ ] The compose override sets `tmpfs` for `/var/lib/postgresql/data`, fixed test env values, and project name
  `matchmind-e2e`.
- [ ] Update the E2E section of `AGENTS.override.md` (owner-approved doc change) to run against the e2e stack by default.
- [ ] One-off for today's junk: the admin archives the `e2e-*` providers in the UI (cascade by filter) and filters users by
  Active to disable `viewer-*`. No migration with environment-specific data.

### Rollout / rollback

- The columns are nullable, so behaviour is unchanged until something is archived or merged.
- Rollback: unarchive and unmerge through the API, or a code revert. Data stays intact.

Effort: **L** (about 4–5 days: schema+filters 1.5, merge/ingest 1, admin API 0.5, UI 1.5, E2E 0.5).
