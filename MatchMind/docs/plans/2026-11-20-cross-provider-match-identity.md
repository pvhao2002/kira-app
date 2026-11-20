# Cross-provider match identity + admin "Merge matches" (UX-047 + UX-104 merge part)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans.
> Migration numbers are `V<next>`.

## Problem

- A match is owned by one provider: `ux_matches_provider_external (provider_id, external_match_id)`.
  `predictions.fk_predictions_match (match_id, provider_id)` pins each prediction to its own provider's match row.
- The same real fixture sent by two agents therefore becomes two `matches` rows. "Model comparison"
  (`ReportService.modelComparison`, `GROUP BY p.match_id HAVING count(DISTINCT p.ai_model_id) >= :minModels`) can never
  compare models of different agents. That comparison is the product's main question.
- Within one provider, spelling variants also split one fixture into several rows (UX-104: 5 rows for 6 spellings).
  The within-provider *normalisation* of `PredictionIngestionService.externalIdByTeams` belongs to another lane. Only the
  *merge* is in this plan.

## Hard constraints from the current design

- `predictions` are immutable snapshots (`@Immutable`, and DB triggers once UX-088 lands). **A merge must never
  `UPDATE predictions.match_id`.**
- `prediction_pick_results` are append-only. A merge must not rewrite settlement.
- The composite FKs mean a prediction can only point at a match of its own provider. A single global match row would
  require dropping them.

## Options

| | Option | Trade-off |
|---|---|---|
| A | Global matches: drop `provider_id` from `matches`, re-point predictions. | Rewrites immutable rows and drops the composite FKs ("integrity lives in the DB"). Huge migration. Result ownership becomes unclear. **Rejected.** |
| B | **Fixture layer: a new `fixtures` table and a nullable mutable `matches.fixture_id`. Auto-link on ingest by a normalised soft key. An admin can merge or unlink. Reports compare by fixture (recommended).** | Additive. Predictions and settlement are untouched. Links are reversible and audited. Each provider still owns its match row and result. Cost: report SQL groups by `COALESCE(m.fixture_id, m.id)`, and two result sources per fixture can disagree. |
| C | Self-reference `matches.canonical_match_id`. | One column fewer than B. But "which row is canonical" breaks when the canonical row is unlinked or merged again (chains), and there is no place for the normalised key. B is the same size with a clean root. |

**Recommendation: B.**

## Decisions needed from the owner

1. **Soft key.** Recommended: auto-link on normalised `home + away` and `start_time` within **±6 h**.
   - League is a tie-breaker only. League names vary ("Premier League" vs "English Premier League"), and screenshot
     ingests use `Unknown league`.
   - Should a league mismatch block the link instead?
2. **Auto-link or suggest-only?** Recommended: auto-link on an *exact* normalised key match, plus an admin
   "Suggested merges" list for near matches. The alternative, suggest-only, is safest but leaves comparison empty until an
   admin acts.
3. **Results across linked matches.**
   - (a) Each provider keeps its own result (status quo). The fixture shows a **"result mismatch"** badge when member
     results differ (recommended for phase 1).
   - (b) A result applied by a trusted source (admin, or a key with the `RESULTS` scope from the per-provider-keys plan)
     propagates to every member match, with a `match_result_history` row per member.
   - (b) fixes the "provider B never posts a result" gap, but it couples this plan to UX-027.
4. **Same-provider merge (UX-104).** With linking, two rows of one provider stay separate: each keeps its predictions and
   needs its own result. Recommended: same-provider members of one fixture **share results automatically**. Applying a
   result to one row applies it to its same-provider siblings, in the same transaction, with a history row each. The same
   authority is acting, so this is safe. Approve?
5. **Normalisation rules.**
   - Lower-case.
   - Strip diacritics (NFD + remove marks).
   - Drop punctuation.
   - Collapse whitespace.
   - Drop the tokens `fc`, `cf`, `sc`, `afc`, `ac` at the start or end.
   - Keep `w`, `u19`, `u21`, `ii`/`b`, so women's and youth teams stay distinct.
   - Any additions (for example `de` in "Atletico de Madrid")? Recommended: no stop-word list in phase 1. The admin merge
     covers the rest.

## Blast radius (GitNexus, upstream)

| Symbol | Risk | Notes |
|---|---|---|
| `PredictionIngestionService` (`upsertMatch`, `externalIdByTeams` are private, not indexed) | LOW | `ExternalController` |
| `MatchResultService` | LOW | `ExternalController` |
| `Match` entity | **UNKNOWN/CRITICAL** (graph count of about 1,377 is inflated by same-name classes in other modules; 5 direct in MatchMind) | Adding a nullable column to the entity is additive. Confirm with `grep -rn "Match\b" matchmind-api/src/main/java/com/matchmind` |
| `ReportService`, `MatchQueryService` | UNKNOWN (no callers resolved) | Text search: called only by `ReportController` / `MatchController` |

Warn: the `Match` entity carries a CRITICAL label. Keep the entity change to one nullable `fixtureId` field, and put all
fixture logic in a new `match/FixtureService`.

## Global constraints

- No `UPDATE`/`DELETE` on `predictions*` or `prediction_pick_results`. Only `matches.fixture_id` and the new fixture tables
  change.
- Every link or unlink writes an append-only `fixture_link_history` row (who, when, reason, from/to fixture).
- Concurrency: auto-link takes `pg_advisory_xact_lock(hashtext(norm_home || '|' || norm_away))` inside the ingest
  transaction, so two first callbacks for one fixture create one fixture.
- Reports keep SQL aggregation and whitelisted sorts.

## Review Focus

1. Two providers ingest the same new fixture concurrently: one fixture with two members. Never two fixtures.
2. Same teams, a second leg or a replay 3 days later: a separate fixture. The window is ±6 h, never by date only.
3. Unlinking a match gives the model comparison back its per-match view. No prediction or settlement row changes
   (assert counts and hashes before and after).
4. Merging two fixtures that each have results that differ: a mismatch badge and a 200, never a silent overwrite.
5. `Unknown league` matches still link on teams + time.

---

### Task 1: Migration `V<next>__fixtures.sql`

**Files:** Create `matchmind-api/src/main/resources/db/migration/V<next>__fixtures.sql`.

- [ ] Create the fixtures table:
  ```sql
  CREATE TABLE fixtures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      norm_home VARCHAR(160) NOT NULL, norm_away VARCHAR(160) NOT NULL,
      start_time TIMESTAMPTZ NOT NULL, league VARCHAR(160),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by UUID REFERENCES users (id));
  CREATE INDEX ix_fixtures_key ON fixtures (norm_home, norm_away, start_time);
  ALTER TABLE matches ADD COLUMN fixture_id UUID REFERENCES fixtures (id);
  CREATE INDEX ix_matches_fixture ON matches (fixture_id);
  CREATE TABLE fixture_link_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), match_id UUID NOT NULL REFERENCES matches (id),
      from_fixture_id UUID REFERENCES fixtures (id), to_fixture_id UUID REFERENCES fixtures (id),
      source VARCHAR(16) NOT NULL CHECK (source IN ('AUTO','ADMIN_MERGE','ADMIN_UNLINK','BACKFILL')),
      reason TEXT, changed_by UUID REFERENCES users (id), changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT ck_fixture_link_admin_reason CHECK (source NOT LIKE 'ADMIN%' OR (reason IS NOT NULL AND changed_by IS NOT NULL)));
  ```
- [ ] No SQL backfill. Normalisation lives in Java (Task 2), so the backfill is a one-off admin action (Task 4).
- [ ] If UX-088 has landed, add `fixture_link_history` to its append-only trigger list.

### Task 2: Normaliser

**Files:**
- Create `shared/TeamNames.java`. If the UX-104 normalisation lane already added a helper, **reuse it instead**.
- Test: `shared/TeamNamesTest.java`.

- [ ] Write `static String normalize(String team)` following decision 5.
- [ ] Table test. These inputs all normalise to the same value: `Atlético Madrid`, `Atletico Madrid`, `Atlético Madrid FC`,
  `Atletico  Madrid`, `ATLÉTICO MADRID`.
- [ ] These stay distinct: `Arsenal W` ≠ `Arsenal`, and `Real Madrid II` ≠ `Real Madrid`.

### Task 3: Auto-link on ingest

**Files:**
- Create `match/FixtureService.java`.
- Modify `PredictionIngestionService.upsertMatch`: one call after the match lock.
- Test: `it/FixtureLinkIT.java`.

**Interfaces:**
- `UUID linkOnIngest(Match m)`. It is a no-op when `m.fixtureId != null`. Otherwise it takes the advisory lock and finds a
  fixture with `norm_home = :h AND norm_away = :a AND start_time BETWEEN :t - 6h AND :t + 6h`, nearest first. If none
  exists, it creates one. Then it sets `matches.fixture_id` and writes history `AUTO`.
- Home/away swapped is **not** linked. The teams are reported in the fixture's order, and a swap is a real data error.

ITs:
- [ ] `twoProvidersSameFixtureShareOneFixture`
- [ ] `concurrentFirstCallbacksCreateOneFixture` (two threads)
- [ ] `sameTeamsThreeDaysLaterIsNewFixture`
- [ ] `spellingVariantsLink`

### Task 4: Admin merge / unlink / suggestions

**Files:** Modify `match/MatchController.java` and `match/FixtureService.java`. Test: `it/FixtureAdminIT.java`.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/v1/fixtures/suggestions?page&size` | | Pairs of unlinked or differently linked matches with the same normalised teams within ±24 h, or a team-name trigram match (no extension, Java-side over a SQL candidate window). Paged |
| POST | `/api/v1/fixtures/merge` | `{matchIds: [uuid…] (2..20), reason}` | Moves every listed match (and their fixture siblings) to one target fixture: the oldest. History `ADMIN_MERGE`. Returns the fixture view with `resultMismatch` |
| POST | `/api/v1/matches/{id}/unlink` | `{reason}` | Gives the match a fresh fixture of its own. History `ADMIN_UNLINK` |
| POST | `/api/v1/fixtures/backfill` | | One-off: runs `linkOnIngest` for every match with `fixture_id IS NULL`. Idempotent. History `BACKFILL` |

- [ ] ITs:
  - Viewer gets 403.
  - Merge leaves `predictions`/`prediction_pick_results` row counts and `payload_hash` unchanged.
  - Unlink restores separation.
  - The reason is required (400 `VALIDATION_ERROR`).
- [ ] Decision 4: in `MatchResultService.apply`, after applying, copy the result to same-provider fixture siblings in the
  same transaction. Add the IT `sameProviderSiblingsShareResult`.

### Task 5: Reports and match detail by fixture

**Files:** Modify `report/ReportService.java` (`modelComparison`) and `match/MatchQueryService.java` (detail adds
`fixture: {id, members:[{matchId, provider, externalMatchId, status, finalScore}], resultMismatch}`).

- [ ] Model comparison groups by `COALESCE(m.fixture_id, m.id)` as `"fixtureId"`:
  - `HAVING count(DISTINCT p.ai_model_id) >= :minModels`.
  - The `DISTINCT ON` becomes `(fixture key, p.ai_model_id)`.
  - Each entry keeps `matchId` and gets `providerName`.
  - `resultMismatch` is `count(DISTINCT (m.final_home_score, m.final_away_score)) FILTER (WHERE m.status='FINISHED') > 1`.
- [ ] Response contract: rows gain `fixtureId` and `resultMismatch`, and `matchId` stays (the first member). This is an
  additive change. Update `docs/API_DOCUMENTATION.md`, `core/models.ts` and samples.
- [ ] IT in `ReportsIT`: two providers, one fixture, `minModels=2` gives 1 row with 2 models.

### Task 6: UI

**Files:** `pages/match-detail.ts` (Fixture panel: members, mismatch badge, Unlink for admin),
`pages/matches.ts` (admin multi-select + "Merge matches" dialog with reason), new tab "Suggested merges" in `pages/matches.ts`.

- [ ] Spec: the merge dialog needs a reason and 2 or more rows; a viewer sees no buttons.

### Rollout / rollback

1. Deploy (the column is NULL, so behaviour is unchanged except new ingests auto-link).
2. The admin runs `POST /fixtures/backfill`.
3. The admin reviews suggestions.

Rollback:
- Code: model comparison falls back to `m.id`.
- Data: `fixture_id` can stay, because nothing else reads it. History is kept.

Effort: **L** (about 5 days: schema+link 1.5, admin API 1.5, reports 1, UI 1).
