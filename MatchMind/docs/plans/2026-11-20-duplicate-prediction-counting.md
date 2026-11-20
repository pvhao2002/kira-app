# Counting policy for near-duplicate predictions (UX-046, report part)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans.
> Migration numbers are `V<next>`.

## Problem

- Idempotency is `(provider_id, external_event_id)` plus the payload hash. LLM agents invent `eventId`s, so a retry
  creates a second, identical prediction (201). Both are settled.
- That behaviour is correct per AGENTS.override and stays. But reports then count the same opinion twice:
  - Picks, units and n double for that match. The win *ratio* barely moves, because duplicates have identical results.
    The match is simply over-weighted.
  - The "small sample" badge (UX-018) and ROI become misleading.
  - "Predictions = 2" shows on the match.
- The same happens with revisions: the agent re-sends a slightly changed prediction for the same match, type and minute.

## How "the same prediction" can be detected without touching snapshots

`predictions.payload` is JSONB, and JSONB text output is canonical (sorted keys, normalised whitespace). So a **stored
generated column**
`content_hash = md5((payload - 'eventId' - 'predictedAt' - 'metadata')::text)` identifies exact re-sends.
- It is computed by PostgreSQL for old and new rows when the column is added.
- It needs no row `UPDATE`, so it is compatible with the UX-088 immutability triggers. `ALTER TABLE` rewrites the table but
  fires no row triggers.
- The model is not always in the payload (it is usually in a header), so "same" also requires the same `ai_model_id` and
  `match_id`.

## Options

| | Option | Effect on win rate / units | Trade-off |
|---|---|---|---|
| A | **"Latest counts": per (effective model, match, `prediction_type`, `match_minute`), only the latest `predicted_at` is counted in aggregates. Older ones stay visible and are marked "not counted" (recommended).** | Removes exact retries and same-moment revisions. Each model has one opinion per match and moment. n drops to honest values, and units stop doubling. | Changes historical figures once. It also hides earlier PRE_MATCH opinions when an agent re-predicts as odds move, which is intended: one pre-match view per match. Query-time only, so it is fully reversible. |
| B | `duplicateOf` flag, exact content only: exclude a prediction whose `content_hash` equals an earlier one (same model and match). | Removes pure retries only. Revisions still double-count. | Narrow and safe. The flag is computed at query time from `content_hash`, never written to the immutable row. |
| C | Count everything and only warn (status quo + UI warning). | Unchanged (inflated). | Zero risk, but it does not fix the reports. |

**Recommendation: A as the default policy, with B's exact-match signal used for warnings.**
- Reports take `countPolicy=latest|all` (default `latest`), so the old numbers stay reproducible.
- Import and Prediction detail warn using exact `content_hash` matches.

## Decisions needed from the owner

1. **Default policy.** Recommended: `latest`. Choose `exact` (option B) if earlier PRE_MATCH opinions must keep counting.
   Choose `all` to keep today's numbers as the default.
2. **Minute granularity.** Recommended: exact `match_minute` (NULL for PRE_MATCH compares equal). Alternative: buckets of
   5 minutes, which collapses more LIVE re-sends but merges genuinely different moments.
3. **Reject exact re-sends at ingest?** Recommended: **no**. Keep 201 (AGENTS.override) and return `possibleDuplicateOf` in
   the response. The alternative is a 200 `duplicate=true` keyed on `content_hash`. That changes the idempotency contract
   and needs an AGENTS.override change.
4. **Which figures follow the policy?** Recommended:
   - Every aggregate follows it: dashboard totals, win rate, units/ROI, model performance, breakdown, market, Monte Carlo
     summary, correct-score accuracy, `AiModelService` stats and calibration.
   - **Lists do not**: Predictions page, prediction history report, match detail. They show all rows with a "not counted"
     marker.
5. **Cross-plan keys.** When the fixtures plan lands, should the key use the fixture (`COALESCE(m.fixture_id, m.id)`)
   instead of `match_id`? Recommended: yes. When the model-merge plan lands, it should use the effective model. Confirm
   the ordering of plans.

## Owner decisions (2026-11-20)

1. Default policy **`latest`**. Dashboard win rate and ROI will change versus today, because re-sends stop counting
   more than once; say so in the release note.
2. Exact `match_minute` (NULL = NULL for PRE_MATCH); no 5-minute buckets.
3. No rejection at ingest: keep 201 and return `possibleDuplicateOf`. The idempotency contract is unchanged.
4. Every aggregate follows the policy; lists (Predictions page, prediction history, match detail) show all rows with a
   "not counted" marker.
5. Yes: key on `COALESCE(m.fixture_id, m.id)` once fixtures land and on the effective model once model merge lands.
   Plan order: db-level-integrity → archive/merge → fixtures → duplicate counting; ROI and per-provider keys are
   independent.

## Blast radius (GitNexus, upstream)

| Symbol | Risk | Notes |
|---|---|---|
| `ExternalDtos` (`PredictionResponse`) | **CRITICAL** (9 dependants: `ExternalController`, `MatchResultService`, `PredictionImportController`, `PredictionIngestionService`, `PredictionValidator`, `SecurityConfig`, `SettlementController`, `SettlementService`) | Only `PredictionResponse` changes: one new trailing component `UUID possibleDuplicateOf`. Its constructor is called in `PredictionIngestionService.ingest` and `.duplicate` only (text search). The JSON change is additive for agents |
| `Filters` | graph result is noisy (name collides with web files). Treat as **HIGH** by usage | Every report method, `PredictionQueryService.list`, `new Filters(...)` in `ReportService.dashboard` |
| `ReportService`, `PredictionQueryService` | UNKNOWN (no callers resolved) | Text search: `ReportController`, `PredictionController` |
| `PredictionIngestionService` | LOW | `ExternalController` |

## Global constraints

- No UPDATE of `predictions`. `content_hash` is a generated column, and "not counted" is computed in SQL at read time.
- One shared SQL fragment (`Stats.COUNTED`), so every aggregate applies the same policy.
- Sort and filter whitelists are unchanged. `countPolicy` is validated (`latest|all`, else `400 INVALID_COUNT_POLICY`).

## Review Focus

1. Two identical predictions with different `eventId`s: `latest` counts 1 prediction and its picks once. `all` counts 2.
2. Two LIVE predictions at minutes 30 and 60: both are counted (different moments).
3. Equal `predicted_at` for two rows: exactly one is counted. The tie-break is `(predicted_at, created_at, id)`.
4. `possibleDuplicateOf` is null for the first send and set for the re-send. The response shape is otherwise unchanged.
   An agent with strict parsing ignores the extra field (check `docs/chatgpt-action.yaml` schema `additionalProperties`).
5. A filter by date range does not change *which* prediction is latest. Latest is decided over all rows of the key, then
   filtered. Otherwise narrowing dates would resurrect older duplicates.

---

### Task 1: Migration `V<next>__prediction_content_hash.sql`

**Files:** Create `matchmind-api/src/main/resources/db/migration/V<next>__prediction_content_hash.sql`.

- [ ] Add the column and indexes:
  ```sql
  ALTER TABLE predictions ADD COLUMN content_hash CHAR(32)
      GENERATED ALWAYS AS (md5((payload - 'eventId' - 'predictedAt' - 'metadata')::text)) STORED;
  CREATE INDEX ix_predictions_dedupe ON predictions (match_id, ai_model_id, prediction_type, match_minute, predicted_at DESC);
  CREATE INDEX ix_predictions_content ON predictions (match_id, ai_model_id, content_hash);
  ```
- [ ] `Prediction.java`: map nothing, or map `contentHash` as `insertable=false, updatable=false`. The entity is `@Immutable`
  already.
- [ ] If UX-088's triggers already exist, confirm the IT still passes. `ADD COLUMN … STORED` does not fire row triggers.

### Task 2: Counted fragment + policy parameter

**Files:** Modify `shared/Stats.java` and `shared/Filters.java`. Test: `it/ReportsIT.java`.

**Interfaces:**
- `Stats.COUNTED`:
  ```sql
  NOT EXISTS (SELECT 1 FROM predictions q
              WHERE q.match_id = p.match_id AND q.ai_model_id = p.ai_model_id
                AND q.prediction_type = p.prediction_type AND q.match_minute IS NOT DISTINCT FROM p.match_minute
                AND (q.predicted_at, q.created_at, q.id) > (p.predicted_at, p.created_at, p.id))
  ```
  The subquery is deliberately **not** date-filtered (Review Focus 5). After the model-merge and fixture plans, replace
  `ai_model_id`/`match_id` with the effective model and fixture key.
- `Filters` gains `String countPolicy` (null means `latest`). `where(boolean pickLevel, boolean aggregate)`: when
  `aggregate && !"all".equals(countPolicy)`, it ANDs `Stats.COUNTED`. The existing `where(boolean)` stays and delegates
  with `aggregate=true`. List callers (`predictionHistory`, `predictionHistoryExport`, `PredictionQueryService.list`) pass
  `false`.

- [ ] ITs:
  - `latestPolicyCountsExactResendOnce`
  - `allPolicyKeepsOldNumbers`
  - `liveSnapshotsAtDifferentMinutesBothCount`
  - `dateFilterDoesNotResurrectOlderDuplicate`
  - `invalidCountPolicyIs400`
- [ ] Apply the policy in `ReportService` (all aggregate methods, dashboard `totals`/`predictionsToday`/charts),
  `AiModelService` (its own SQL: add `AND <COUNTED>` with `p` aliasing `pr`) and `MatchQueryService` model summaries.

### Task 3: Warnings at ingest and in detail views

**Files:**
- Modify `external/ExternalDtos.java` (`PredictionResponse` + `UUID possibleDuplicateOf`) and
  `prediction/PredictionIngestionService.java`. After the insert, run
  `SELECT id FROM predictions WHERE match_id=:m AND ai_model_id=:a AND content_hash = (SELECT content_hash FROM predictions WHERE id=:new) AND id<>:new ORDER BY predicted_at LIMIT 1`.
  The `.duplicate(...)` path also returns it.
- Modify `prediction/PredictionQueryService.java`: detail gains `"counted": boolean` and
  `"similar": [{predictionId, predictedAt, exact}]` (the same key; `exact` = same `content_hash`). List rows gain
  `"counted"`.
- Tests: `it/PredictionImportIT.java` (`resendWithNewEventIdReturnsPossibleDuplicateOf`) and `it/ExternalCallbackIT.java`
  (first send has a null field).

- [ ] Update `docs/API_DOCUMENTATION.md` (both the external response and the detail), `docs/samples/*.json`,
  `core/models.ts` and `docs/chatgpt-action.yaml` (response schema).

### Task 4: UI

**Files:**
- `pages/import.ts`: a warning toast/banner "Same content as prediction X (sent at …). It is stored but counted once in
  reports", linking to X.
- `pages/prediction-detail.ts`: a "Not counted: superseded by …" banner and a "Similar predictions" list.
- `pages/predictions.ts`: a muted "not counted" tag.
- `pages/reports.ts` and `pages/dashboard.ts`: a "Count: latest per moment / all" select, kept in `?count=`, with a
  footnote "N predictions not counted".

- [ ] Specs: the banner shows when `possibleDuplicateOf` is set; the select sends `countPolicy`.

### Rollout / rollback

- The migration is additive. Its cost is a table rewrite of `predictions`: run it off-peak, which takes seconds at current
  volumes.
- Deploy with the default `latest` and announce that figures changed once.
- Rollback: set the default to `all` (one constant). The column and indexes can stay.

Effort: **L** (about 3 days: migration+fragment 1, wiring all aggregates 1, warnings+UI 1). Effort is **M** if decision 1
is `exact` only.
