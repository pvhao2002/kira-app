# Pre-match vs Live Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Reports tab "Pre-match vs Live" that shows PRE_MATCH and LIVE pick stats side by side per model, market or league, with the LIVE − PRE_MATCH difference.

**Architecture:** One new read endpoint in `ReportService`/`ReportController` that reuses `PICKS_FROM` + `AGG`, groups by `(key, p.prediction_type)` and pivots in Java. The web Reports page gets a seventh tab whose resource runs only while the tab is active; its KPI strip reuses the existing `breakdown(f, 'type')`.

**Tech Stack:** Java 25, Spring Boot 3.5, JDBC, PostgreSQL 17, Testcontainers ITs; Angular 22 standalone + signals, Vitest.

**Spec:** `MatchMind/docs/superpowers/specs/2026-11-24-type-comparison-report-design.md`

## Global Constraints

- Rules: `MatchMind/AGENTS.override.md`. API, `core/models.ts`, `docs/API_DOCUMENTATION.md` and `docs/samples/*.json` change together.
- Rates/units/deltas are `BigDecimal` / `NUMERIC`, never `double`.
- `by` is whitelisted (`model`, `market`, `league`); anything else → `400 INVALID_GROUP`. No user input concatenated into SQL.
- The `type` filter is ignored by this report; every other filter and `countPolicy` apply.
- UI: missing numbers render `—`, never `0`. Errors show the API `message`. Table full-width and dense.
- No new dependency, no migration, no chart.
- Do not commit without the user's go-ahead (repo rule); commit steps below are run only once authorised.

## Review Focus

1. Request with `type=LIVE` → both `preMatch` and `live` still filled (type filter dropped). Test in Task 1.
2. Group with only one type (e.g. model that never predicts LIVE) → other side `null`, both deltas `null`, UI shows `—`. Tests in Task 1 and Task 2.
3. One side with only pending picks → its `winRate`/`roi` `null` → delta `null`, not a number. Test in Task 1.
4. `by=type` or `by=x` → `400 INVALID_GROUP`. Test in Task 1.
5. Changing the group-by select while a request is in flight → old response never lands (resource `params` include `by`). Covered by the resource pattern; Task 2 test checks the `by` param is sent.

---

### Task 1: API endpoint `GET /api/v1/reports/type-comparison`

**Files:**
- Modify: `MatchMind/matchmind-api/src/main/java/com/matchmind/report/ReportService.java` (new method after `breakdown`, ~line 133)
- Modify: `MatchMind/matchmind-api/src/main/java/com/matchmind/report/ReportController.java` (new mapping after `breakdown`)
- Modify: `MatchMind/docs/API_DOCUMENTATION.md` (row after `GET /reports/breakdown`, line ~464)
- Create: `MatchMind/docs/samples/report-type-comparison.json`
- Test: `MatchMind/matchmind-api/src/test/java/com/matchmind/it/ReportsIT.java`

**Interfaces:**
- Produces: `GET /api/v1/reports/type-comparison?by=model|market|league` (default `model`) + shared filters →
  `[{ key: string, preMatch: Counts | null, live: Counts | null, winRateDelta: number | null, roiDelta: number | null }]`,
  where `Counts` = exactly the fields a `breakdown` row has minus `key` (AGG columns + `winRate` + `roi`).
  Ordered by `preMatch.picks + live.picks` desc, then `key` asc.
- Java: `public List<Map<String, Object>> typeComparison(Filters f, String by)` in `ReportService`, `@Transactional(readOnly = true)`.

- [ ] **Step 1: Write the failing ITs in `ReportsIT`**

Seed with existing helpers: `newIntegration(...)`, `external(in.provider(), "predictions", Payloads.preMatchWithCorners(...))` and `Payloads.livePrediction(...)` on the same model; filter by `?providerId=` + `providerId(in)`.

```java
@Test void typeComparisonPutsBothTypesInOneRowAndIgnoresTypeFilter() // seed 1 PRE_MATCH + 1 LIVE, same model
    // GET /api/v1/reports/type-comparison?providerId=..&type=LIVE&by=model
    // size()==1; row.key == "<modelName> <version>"; row.preMatch.picks > 0; row.live.picks > 0
@Test void typeComparisonMissingSideIsNullAndDeltasNull() // seed only LIVE (pending)
    // row.preMatch.isNull(); row.winRateDelta.isNull(); row.roiDelta.isNull()
    // row.live.winRate.isNull() (all pending)
@Test void typeComparisonDeltaIsLiveMinusPreMatch() // settle: PRE_MATCH picks lose, LIVE picks win (Payloads.result)
    // winRateDelta == live.winRate - preMatch.winRate (isEqualByComparingTo), roiDelta likewise
@Test void typeComparisonRejectsUnknownGroup() // by=type -> 400, code INVALID_GROUP
```

- [ ] **Step 2: Run, confirm they fail**

Run: `cd MatchMind/matchmind-api && mvn -B verify -Dit.test=ReportsIT -Dtest=none -Dsurefire.failIfNoSpecifiedTests=false` (Docker running)
Expected: the four new tests FAIL with 404 (no endpoint).

- [ ] **Step 3: Implement `typeComparison` + controller mapping**

- `by` switch: `model` → `Sql.MODEL_NAME + " || ' ' || am.version"`, `market` → `pk.market`, `league` → `mm_league(m.league)`; default → `ApiException.badRequest("INVALID_GROUP", "by must be model, market or league")`.
- Drop the type filter: `new Filters(f.from(), f.to(), f.league(), f.modelId(), f.providerId(), null, f.market(), f.matchId(), f.search(), f.result(), f.includeArchived(), f.countPolicy())`, then `.where(true)`.
- SQL: `"SELECT " + key + " AS \"key\", p.prediction_type AS \"type\", " + AGG + PICKS_FROM + w.sql() + " GROUP BY 1, 2"`.
- Pivot into a `LinkedHashMap<key, row>`; each side = the SQL row minus `key`/`type`, passed through `addRates`. Delta: `live.winRate.subtract(preMatch.winRate)` when both non-null, else `null`; same for `roi`. Sort as in Interfaces.
- Controller: `@GetMapping("/reports/type-comparison")`, `@Operation(summary = "PRE_MATCH vs LIVE pick performance side by side, grouped by model, market or league (type filter ignored)")`, `@RequestParam(defaultValue = "model") String by`.

- [ ] **Step 4: Run, confirm pass**

Same command as Step 2. Expected: all `ReportsIT` tests PASS.

- [ ] **Step 5: Docs + sample**

Add a table row under `GET /reports/breakdown`: path, `by` values, "type filter ignored", the row shape, delta = LIVE − PRE_MATCH, `null` when a side or a rate is missing. Link `samples/report-type-comparison.json`: one row with both sides, one row with `live: null`.

- [ ] **Step 6: Commit (when authorised)**

```bash
git add MatchMind/matchmind-api/src/main/java/com/matchmind/report MatchMind/matchmind-api/src/test/java/com/matchmind/it/ReportsIT.java MatchMind/docs/API_DOCUMENTATION.md MatchMind/docs/samples/report-type-comparison.json
git commit -m "feat(matchmind-api): pre-match vs live type comparison report"
```

---

### Task 2: Web tab "Pre-match vs Live"

**Files:**
- Modify: `MatchMind/matchmind-web/src/app/core/models.ts` (next to `BreakdownRow`, line ~251)
- Modify: `MatchMind/matchmind-web/src/app/core/api.service.ts` (next to `breakdown`, line ~120)
- Modify: `MatchMind/matchmind-web/src/app/pages/reports.ts` (`Tab` line 20, `TABS` line 21, new `@case`, new resource near line 520)
- Test: `MatchMind/matchmind-web/src/app/pages/reports.spec.ts`

**Interfaces:**
- Consumes: Task 1 endpoint and row shape; existing `breakdown(f, 'type')`.
- Produces:
  - `models.ts`: `export type TypeCompareBy = 'model' | 'market' | 'league';` and
    `export interface TypeComparisonRow { key: string; preMatch: PerformanceCounts | null; live: PerformanceCounts | null; winRateDelta: number | null; roiDelta: number | null; }`
  - `api.service.ts`: `typeComparison(f: Filters, by: TypeCompareBy) => Observable<TypeComparisonRow[]>` (GET `${API}/reports/type-comparison`, `toParams({ ...f, by })`).
  - `reports.ts`: tab value `'typecompare'`, label `'Pre-match vs Live'`; signal `typeBy = signal<TypeCompareBy>('model')`.

- [ ] **Step 1: Write failing specs in `reports.spec.ts`** (use existing `open`, `settle`, `text`, `http`)

```ts
describe('ReportsPage Pre-match vs Live', () => {
  it('requests both reports and renders both sides with deltas', async () => {
    const f = await open('typecompare');
    http.expectOne(r => r.url.endsWith('/reports/breakdown') && r.params.get('by') === 'type').flush([]);
    const req = http.expectOne(r => r.url.endsWith('/reports/type-comparison'));
    expect(req.request.params.get('by')).toBe('model');
    req.flush([{ key: 'gpt 5', preMatch: { ...model, winRate: 0.5, roi: 0.1 }, live: { ...model, winRate: 0.6, roi: 0.2 }, winRateDelta: 0.1, roiDelta: 0.1 }]);
    await settle();
    expect(text(f.nativeElement)).toContain('gpt 5');
    expect(text(f.nativeElement)).toContain('+10.0');   // Δ WR shown as signed percentage points
  });
  it('renders — for a missing side and missing deltas', async () => {
    // flush row { key: 'm', preMatch: model, live: null, winRateDelta: null, roiDelta: null }
    // expect the LIVE and Δ cells of that row to read '—'
  });
});
```

- [ ] **Step 2: Run, confirm they fail**

Run: `cd MatchMind/matchmind-web && npx ng test --watch=false --include src/app/pages/reports.spec.ts`
Expected: FAIL (unknown tab, no request).

- [ ] **Step 3: Add models + API call** (signatures in Interfaces).

- [ ] **Step 4: Add the tab in `reports.ts`**

- `Tab` union and `TABS` gain `{ value: 'typecompare', label: 'Pre-match vs Live' }` (last).
- Two resources gated like the others: `params: () => this.tab() === 'typecompare' ? this.filters() : undefined` for the KPI `breakdown(f, 'type')`, and `{ f, by: this.typeBy() }` for `typeComparison`. Add both to the per-tab state map at line ~529.
- KPI strip: one card per type (PRE_MATCH, LIVE) with picks, win rate (`pct`), units, ROI.
- Group-by: the existing select from `shared/kit.ts` bound to `typeBy` (Model / Market / League).
- Table `class="dt"`, `aria-label="Pre-match vs Live"`, two-level header: `Key | Pre-match: Picks, Win rate, Units, ROI | Live: Picks, Win rate, Units, ROI | Δ Win rate, Δ ROI`. Win rate / ROI headers get `headerTitle` titles. Δ cells: signed percentage points (`+3.8` / `-1.2`), coloured with the existing positive/negative text classes; `null` → `—`. Every missing number → `—` via the page's existing number helper.
- Info line above the table: "The prediction type filter does not apply here."

- [ ] **Step 5: Run, confirm pass, then build**

Run: `cd MatchMind/matchmind-web && npx ng test --watch=false && npx ng build` (Node v26, see override)
Expected: all specs PASS, build succeeds.

- [ ] **Step 6: Commit (when authorised)**

```bash
git add MatchMind/matchmind-web/src/app/core/models.ts MatchMind/matchmind-web/src/app/core/api.service.ts MatchMind/matchmind-web/src/app/pages/reports.ts MatchMind/matchmind-web/src/app/pages/reports.spec.ts
git commit -m "feat(matchmind-web): pre-match vs live report tab"
```

---

### Task 3: Graph check + runtime look

- [ ] **Step 1:** `node .gitnexus/run.cjs detect-changes --scope all --repo .` from repo root. Expected: only the files above, no `partial`/`truncated`.
- [ ] **Step 2 (if runtime QA authorised):** open `/#/reports?tab=typecompare` on the running stack, switch Model/Market/League, set filter type=LIVE and confirm both sides still show. Screenshot for the user.
