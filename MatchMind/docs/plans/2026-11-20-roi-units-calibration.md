# ROI / units, small-sample badge, calibration chart (UX-018)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans.
> No migration is needed: everything is read-side SQL over existing columns.

## Problem

- Win rate is the only performance figure. It looks the same at n = 2 and at n = 2,000.
- Prices are already stored per pick through the odds snapshot (`prediction_odds.*_odds`, chosen by `Sql.PRICE`), but no
  profit or ROI is computed.
- There is no check of whether a model's stated `probability` matches reality (calibration).

## Options

| | Option | Trade-off |
|---|---|---|
| A | **Compute in SQL at read time, inside the shared `Stats`/`ReportService.AGG` fragments, so every report gets `units`/`staked`/`roi` at once (recommended).** | One fragment, and dashboard, models, market, breakdown and model-performance all agree (the same reason `Stats` exists). No schema change. NUMERIC arithmetic is exact. Cost: one more `CASE` per aggregate. Fine at current volumes. |
| B | Store `profit_units NUMERIC` on each `prediction_pick_results` row at settle time. | Cheaper reads, and the history is frozen per row. But it needs a migration and a `SettlementEngine.VERSION` bump. Old rows have no value unless a backfill runs, and a backfill UPDATE would violate append-only (UX-088). Units are a pure function of (result, price), so storing them adds nothing. |
| C | Compute in Java after fetching picks. | Ships whole datasets to the app. Violates "aggregate in SQL". |

**Recommendation: A.**

**Fixed stake of 1 per pick, per the backlog:**

| Result | Units |
|---|---|
| WIN | `price − 1` |
| HALF_WIN | `(price − 1) / 2` |
| PUSH | `0` |
| HALF_LOSS | `−0.5` |
| LOSS | `−1` |
| VOID, PENDING | excluded |

`roi = units / staked`, where `staked` counts picks with result ∈ {WIN, HALF_WIN, PUSH, HALF_LOSS, LOSS}.

## Decisions needed from the owner

1. **ROI denominator.** Recommended: `staked` includes PUSH (the stake was placed and returned) and excludes VOID (the bet
   was cancelled). The alternative excludes PUSH too, which gives a slightly higher |ROI|.
2. **Small-sample definition.** Recommended:
   - The badge shows when **n < 30**.
   - For the win rate, n = `wins + losses` (its denominator).
   - For ROI, n = `staked`.
   - The threshold is a UI constant. Should it be configurable per deployment? Recommended: no.
3. **Calibration outcome for half results.** Recommended: count WIN = 1 and LOSS = 0 only, and exclude
   HALF_WIN/HALF_LOSS/PUSH/VOID. A quarter-line probability is not a plain win probability. Show "excluded: N".
   Alternative: HALF_WIN = 0.5 and HALF_LOSS = 0.
4. **Calibration bins.** Recommended: 10 fixed bins of width 0.1 (`width_bucket`). Bins with fewer than 5 picks are greyed
   out in the chart.
5. **Which picks.** Recommended: every pick (all ranks), consistent with today's win rate. Should there also be a "top pick
   only" toggle? Recommended: not now.

## Owner decisions (2026-11-20)

All as recommended:
1. `staked` includes PUSH, excludes VOID.
2. Small-sample badge at n < 30 (win rate n = wins + losses; ROI n = staked); a UI constant, not configurable.
3. Calibration counts WIN = 1 and LOSS = 0 only; halves, PUSH and VOID excluded and shown as "excluded: N".
4. 10 fixed bins of width 0.1; bins with fewer than 5 picks greyed out.
5. Every pick (all ranks); no top-pick toggle.

## Blast radius (GitNexus, upstream)

| Symbol | Risk | Dependants |
|---|---|---|
| `Stats` | LOW | `AiModelService`, `MatchQueryService`, `ReportService`, `AiModelController` |
| `AiModelService` | LOW | `AiModelController` |
| `ReportService` | UNKNOWN (no callers resolved) | Text search: `ReportController` only |
| `Filters` | graph result is noisy: name collision with web files | Text search: `ReportService`, `PredictionQueryService`, controllers. Not changed here |

## Global constraints

- `BigDecimal` / `NUMERIC` end to end. Never `double`. `units` is rounded to scale 3, the same as prices, `HALF_UP`.
  `roi` is scale 4.
- Missing values render `—`, never `0`. `roi` is `null` when `staked = 0`.
- The contract change is additive: new fields on existing responses plus one new endpoint. Update
  `docs/API_DOCUMENTATION.md`, `core/models.ts` and `docs/samples/*.json` together.

## Review Focus

1. A model with only PENDING/VOID picks: `units = null` and `roi = null`. The UI shows `—`, not `0.000`.
2. Price exactly at the minimum (1.01) on WIN gives `0.010`. There must be no float artefacts such as `0.0099999`.
3. Probability `1.000000` lands in the top bin, not an 11th bin (`LEAST(width_bucket(...), 10)`).
4. Filters (date, model, market, league) narrow ROI and calibration exactly as they narrow the win rate. Both use
   `Filters.where(true)`.
5. A superseded result never counts. Only `r.is_current` is used (`Stats.CURRENT_RESULT_JOIN`).

---

### Task 1: SQL fragments

**Files:** Modify `shared/Stats.java`. Test: `shared/SharedHelpersTest.java`.

**Interfaces (produced):**
- `Stats.UNITS`: `round(sum(CASE r.result WHEN 'WIN' THEN (<PRICE> - 1) WHEN 'HALF_WIN' THEN (<PRICE> - 1) / 2 WHEN 'PUSH' THEN 0 WHEN 'HALF_LOSS' THEN -0.5 WHEN 'LOSS' THEN -1 END), 3)`, with `<PRICE>` = `Sql.PRICE`. It needs aliases `pk`, `o` and `r`.
- `Stats.STAKED`: `count(*) FILTER (WHERE r.result IN ('WIN','HALF_WIN','PUSH','HALF_LOSS','LOSS'))`.
- `static BigDecimal roi(BigDecimal units, long staked)`: null when `staked == 0` or `units == null`; otherwise
  `units.divide(BigDecimal.valueOf(staked), 4, HALF_UP)`.

- [ ] Write the tests: `roi(new BigDecimal("-0.050"), 5)` equals `new BigDecimal("-0.0100")`; `roi(null, 0)` is null;
  `roi(BigDecimal.ONE, 0)` is null.
- [ ] Implement the fragments and `roi`.

### Task 2: Reports + dashboard + models

**Files:** Modify `report/ReportService.java` and `model/AiModelService.java`. Test: `it/ReportsIT.java`.

- [ ] Report changes:
  - Append `, %s AS "units", %s AS "staked"` (`Stats.UNITS`, `Stats.STAKED`) to `ReportService.AGG`.
  - Rename `addWinRate` to `addRates`, which also puts `roi`. Its callers are `modelPerformance`, `breakdown`,
    `marketPerformance` and `dashboard`.
  - Add `"staked"` to `COUNT_COLUMNS`. For an empty market, `units` stays null.
- [ ] Dashboard: `winRateOverTime` gains `units` per day. The UI draws the cumulative sum.
- [ ] History rows (`HISTORY_COLUMNS`) gain `"units"`, the per-pick value (the same `CASE` without `sum`). Add it to the
  export columns after `result`.
- [ ] `AiModelService.SQL`:
  - Add `JOIN prediction_odds o ON o.id = pk.odds_id` to the LATERAL.
  - Select `UNITS`/`STAKED`.
  - `ModelView` gains `BigDecimal units, long staked, BigDecimal roi`.
- [ ] IT `roiAndUnitsFollowFixedStake`:
  - Seed one prediction with picks priced 1.90, 2.10, 1.80, 1.95, 2.00 and 1.85.
  - Set the results through the admin override (`POST /api/v1/settlements/picks/{id}/override`) to WIN, HALF_WIN, LOSS,
    HALF_LOSS, PUSH and VOID.
  - Assert in model-performance: `units = -0.050`, `staked = 5`, `roi = -0.0100`, and that `winRate` is unchanged.
  - Assert the same figures on `GET /models/{id}` and the dashboard totals.

### Task 3: Calibration endpoint

**Files:** Modify `report/ReportService.java` (new `calibration(Filters f)`) and `report/ReportController.java`. Test:
`it/ReportsIT.java`.

- [ ] Add `GET /api/v1/reports/calibration?<standard filters>`. It returns:
  ```json
  {"bins":[{"bin":1,"from":0.0,"to":0.1,"picks":0,"avgProbability":null,"hitRate":null}, …10],
   "evaluated": 0, "excluded": 0}
  ```
- [ ] SQL:
  - `LEAST(width_bucket(pk.probability, 0, 1, 10), 10)` grouped.
  - Rows are filtered to `r.result IN ('WIN','LOSS')` (decision 3).
  - `hitRate = count(WIN)/count(*)` using `Stats.ratio`.
  - `avgProbability = round(avg(pk.probability), 4)`.
  - Java fills empty bins, so there are always 10.
  - `excluded` = settled picks not in WIN/LOSS.
- [ ] ITs:
  - `calibrationAlwaysReturnsTenBins`
  - `probabilityOneLandsInBinTen`
  - `halfResultsAreExcludedAndCounted`

### Task 4: UI

**Files:**
- `matchmind-web/src/app/core/models.ts`
- `core/api.service.ts`
- `shared/format.ts`: `SMALL_SAMPLE = 30`, and a `units()` formatter with a sign and 3 decimals (`+0.900`, `−1.000`)
- `pages/reports.ts`: model-performance, breakdown and market tables gain Units and ROI columns; a new `?tab=calibration`
  tab uses `shared/chart.ts` (scatter of avgProbability vs hitRate, a y=x diagonal, point size ∝ picks, bins < 5 picks
  greyed out)
- `pages/dashboard.ts`: Units and ROI tiles, and a cumulative-units line
- `pages/models.ts` and `pages/model-detail.ts`

- [ ] Badge: an `mm-badge` "small sample (n = 12)" next to the win rate when `wins + losses < 30`, and next to ROI when
  `staked < 30`. It has a tooltip explaining why.
- [ ] Spec `pages.spec.ts`:
  - Null ROI renders `—`.
  - The badge shows at n = 29 and hides at n = 30.
  - The calibration tab renders 10 bins.
- [ ] Verify with `npx ng test --watch=false && npx ng build`.

### Rollout / rollback

The changes are read-side and additive. Rollback is a code revert, with no data touched.

Effort: **L** (about 3–4 days: SQL+API 1.5, calibration 0.5, UI 1.5).
