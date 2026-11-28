# Next Goal & BTTS sheet prompt + prompt-tuning reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sheet-only Next Goal/BTTS prompt with an in-sheet scoring loop, and a prompt-tuning report (API, web tab,
text for AI agents) plus an edge line in TRACK RECORD, so the prompts' win rate can be tuned.

**Architecture:** Shared SQL bands (`shared/Bands`) and the margin-free market probability (`Sql.MARKET_PROBABILITY`)
feed both TRACK RECORD and a new `PromptTuningService` (one GROUP BY query per dimension over `ReportService.PICKS_FROM`).
The goals flow lives only in the Google Sheet (`MatchMind.gs`), seeded prompts come from Flyway V44.

**Tech Stack:** Java 25 / Spring Boot 3.5 / PostgreSQL 17 / Flyway; Angular 22 (vitest); Apps Script tested with
`node --test`.

**Spec:** `MatchMind/docs/superpowers/specs/2026-11-27-next-goal-btts-and-tuning-reports-design.md`

## Global Constraints

- Odds, lines, probabilities: `NUMERIC`/`BigDecimal` in new code (TRACK RECORD keeps its existing doubles).
- New migration is `V44__next_goal_btts_sheet_prompt.sql`; never edit V1–V43; no dollar-brace pairs in it (Flyway).
- `/api/v1/reports/**` stays admin-only (already in `SecurityConfig`); no key in any prompt text.
- `GOALS` rows are never sent by `sendPending` and never deleted by `cleanupOldRows`.
- API change ⇒ `core/models.ts`, `docs/API_DOCUMENTATION.md`, `docs/samples/*.json` change in the same task.
- UI: missing numbers render as `—`; errors show the API `message`.
- Commit only with the user's authorization (repo rule): the "Commit" steps below are checkpoints, skipped unless
  authorized.

## Review Focus

1. Filters with no settled picks → report still renders (null rates, empty dimension rows, rules `null`), text says
   "No settled picks" — tests in Task 3 and Task 4.
2. GOALS cells typed with a comma decimal (`1,85`) or lower-case picks (`home`) → parsed and scored — Task 6 test.
3. Results that contradict each other (`firstGoal` HOME with 0-0, NONE with 1-0) → `check: …`, left out of the
   report — Task 6 test.
4. The Reports filter bar's `result` filter → ignored by prompt-tuning (settled scope is the point) — Task 4 test.
5. Price exactly on a rule boundary (1.65, 1.90) and probability 0.60 → banded the way the prompt's rules read
   (`<= 1.65` out, `<= 1.90` in, `>= 0.60` in) — Task 4 IT evaluates the band SQL in Postgres.

---

### Task 1: Shared bands and market probability

**Files:**
- Create: `matchmind-api/src/main/java/com/matchmind/shared/Bands.java`
- Modify: `matchmind-api/src/main/java/com/matchmind/shared/Sql.java` (add constant after `PRICE`)
- Test: `matchmind-api/src/test/java/com/matchmind/shared/BandsTest.java`

**Interfaces:**
- Produces: `Bands.Band(String test, String label)` (`test` = comparison suffix such as `"<= 1.65"`, `null` = ELSE);
  `Bands.PRICE`, `Bands.EDGE`, `Bands.PROBABILITY` (`List<Band>`); `static String Bands.sql(String expr, List<Band>)`;
  `Sql.MARKET_PROBABILITY` (aliases `pk`, `o`).
- Band values: PRICE `<= 1.65` "1.65 or lower", `<= 1.80` "1.66-1.80", `<= 1.90` "1.81-1.90", `<= 2.05` "1.91-2.05",
  else "above 2.05". EDGE `<= 0` "0 or below", `<= 0.05` "0 to 0.05", `<= 0.10` "0.05 to 0.10", `<= 0.15`
  "0.10 to 0.15", else "above 0.15". PROBABILITY `< 0.55` "below 0.55", `< 0.60` "0.55-0.59", `< 0.65` "0.60-0.64",
  `< 0.70` "0.65-0.69", else "0.70 or more".

- [ ] **Step 1: Write `BandsTest`**: `sqlIsOneCaseOverTheBands` asserts
  `Bands.sql("x", Bands.PRICE)` equals `CASE WHEN (x) <= 1.65 THEN '1.65 or lower' WHEN (x) <= 1.80 THEN '1.66-1.80' WHEN (x) <= 1.90 THEN '1.81-1.90' WHEN (x) <= 2.05 THEN '1.91-2.05' ELSE 'above 2.05' END`;
  `everyListEndsWithOneCatchAll` asserts for PRICE, EDGE, PROBABILITY: only the last band has `test == null`, no label
  contains `'`.
- [ ] **Step 2: Run** `cd matchmind-api && mvn -q -Dtest=BandsTest test` → FAIL (no `Bands`).
- [ ] **Step 3: Implement** `Bands` and `Sql.MARKET_PROBABILITY` =
  `(1 / (PRICE)) / CASE o.market WHEN '1X2' THEN 1/home+1/draw+1/away WHEN 'AH' or 'CORNER_AH' THEN 1/home+1/away ELSE 1/over+1/under END`.
- [ ] **Step 4: Run** the same command → PASS.

### Task 2: TRACK RECORD edge over the market

**Files:**
- Modify: `matchmind-api/src/main/java/com/matchmind/prompt/TrackRecord.java`
- Test: `matchmind-api/src/test/java/com/matchmind/prompt/TrackRecordTest.java`

**Interfaces:**
- Consumes: `Bands.sql`, `Bands.PRICE`, `Bands.EDGE`, `Sql.PRICE`, `Sql.MARKET_PROBABILITY`.
- Produces: `record Pick(int rank, String side, String type, double prob, String price, String edge, double won)` where
  `price` = `"price " + band`, `edge` = `"edge " + band`, both computed in SQL. `priceBand(double)` is removed.

- [ ] **Step 1: Update `TrackRecordTest`**: picks built with `"price 1.66-1.80"` / `"price 1.91-2.05"` and
  `"edge 0 to 0.05"` / `"edge above 0.15"`; expect the line
  `- By your edge over the market (your probability minus the bookmaker's without margin): edge 0 to 0.05 83% (n 6) · edge above 0.15 42% (n 6)`,
  FAVOUR containing `edge 0 to 0.05 83% (n 6)`, AVOID containing `edge above 0.15 42% (n 6)`; drop
  `bandsPricesTheWayTheRulesTalkAboutThem` (moved to Task 4 IT).
- [ ] **Step 2: Run** `mvn -q -Dtest=TrackRecordTest test` → FAIL (constructor arity).
- [ ] **Step 3: Implement**: SQL alias `k` → `pk`, price via `Sql.PRICE` banded in SQL, add the edge column; add the
  edge line after "By price"; FAVOUR/AVOID candidates = sides + price bands + edge bands.
- [ ] **Step 4: Run** → PASS.

### Task 3: Prompt-tuning text renderer

**Files:**
- Create: `matchmind-api/src/main/java/com/matchmind/report/PromptTuningText.java`
- Test: `matchmind-api/src/test/java/com/matchmind/report/PromptTuningTextTest.java`

**Interfaces:**
- Produces: `static String PromptTuningText.render(String scope, Map<String,Object> total, List<Map<String,Object>> rules, List<Map<String,Object>> dimensions, Map<String,Object> goals)`.
  Row maps carry `wins`, `losses` (Long), `winRate`, `roi`, `avgProbability`, `avgMarketProbability` (BigDecimal or
  null), dimension maps `{by, title, rows}`, rule maps `{rule, text, follows, breaks}` (sides may be null), goals
  `{predictions, avgExpectedGoals, avgActualGoals}`.
- Line format (n = wins + losses): `- <key>: won 57% of 80, ROI -2.0%, stated 65% (8 points too sure), market 54%`;
  gap ≥ 3 → "too sure", ≤ −3 → "too cautious"; n = 0 → `- <key>: no win or loss yet`. Rule line:
  `- <text>: followed won 0% of 1, ROI -100.0% | broken won 67% of 3, ROI +13.3%` (`none` for a null side).
  FAVOUR (≥ 60 %, n ≥ 6) / AVOID (< 45 %, n ≥ 6) over dimensions side, price, edge, probability, line, minute, state,
  league. Goals line: `expected 2.81 goals after the prediction, actual 2.45 (n 90): 0.36 too many`.

- [ ] **Step 1: Write `PromptTuningTextTest`**: `rendersRulesGroupsAndSignals` (one rule with both sides, a price
  dimension with a 6-pick 83 % group and a 6-pick 33 % group, goals) asserts the header names the AI_PREDICTION prompt,
  the scope line, the rule line above, a group line with "points too sure", `FAVOUR (won 60% or more, at least 6 picks): price 1.66-1.80 83% (n 6)`,
  `AVOID (won under 45%, at least 6 picks): price above 2.05 33% (n 6)`, and the goals line;
  `saysSoWhenNothingIsSettled` (zero total, empty dimensions, null rule sides, zero goals) contains
  "No settled picks match these filters" and no exception.
- [ ] **Step 2: Run** `mvn -q -Dtest=PromptTuningTextTest test` → FAIL.
- [ ] **Step 3: Implement** with `BigDecimal` rounding `HALF_UP`.
- [ ] **Step 4: Run** → PASS.

### Task 4: Prompt-tuning report endpoint

**Files:**
- Create: `matchmind-api/src/main/java/com/matchmind/report/PromptTuningService.java`
- Modify: `matchmind-api/src/main/java/com/matchmind/report/ReportController.java`
- Create: `matchmind-api/src/test/java/com/matchmind/it/PromptTuningIT.java`
- Modify: `docs/API_DOCUMENTATION.md` (reports table), Create: `docs/samples/report-prompt-tuning.json`

**Interfaces:**
- Consumes: `ReportService.PICKS_FROM`, `ReportService.AGG`, `ReportService.addRates`, `Bands`, `Sql.*`,
  `PromptTuningText.render`.
- Produces: `GET /api/v1/reports/prompt-tuning` (shared filters, `result` ignored) →
  `{total, rules[{rule, text, follows, breaks}], dimensions[{by, title, rows[{key, ...}]}], goals, text}`; every
  counter row = `AGG` + `winRate`, `roi`, `avgMarketProbability`. Dimension `by` values, in order: `rank, side, price,
  edge, probability, line, minute, state, promptVersion, model, league`. Rule ids: `price, rank2, market, all`.
- Keys: line `"<MARKET> whole|half|quarter line"` (1X2: `"1X2"`), minute `"pre-match" | "live minute 0-30" |
  "live minute 31-60" | "live minute 61-75" | "live minute 76+"`, state `"pre-match" | "live, level" |
  "live, one goal apart" | "live, two or more goals apart"`, promptVersion `"v<n> (saved YYYY-MM-DD)"` or
  `"before the first saved version"` (latest `AI_PREDICTION` version with `created_at <= p.predicted_at`), league
  `mm_league(m.league)` or `"(no league)"`.

- [ ] **Step 1: Write `PromptTuningIT`** (scope `?providerId=` of a new integration): one `Payloads.livePrediction`
  and one `Payloads.preMatchWithCorners(..., "HOME")`, results posted, picks overridden to AH HOME WIN, OU OVER LOSS,
  1X2 HOME LOSS, CORNER_AH HOME WIN. Assert: total settled 4, winRate 0.5, units −0.100, avgMarketProbability ≈ 0.4728
  (±0.0005); price keys `[price 1.81-1.90, price 1.91-2.05, price above 2.05]`; edge keys `[edge 0 to 0.05,
  edge 0.05 to 0.10]` with 2 picks each; minute keys `[pre-match, live minute 31-60]`; state contains
  `live, one goal apart`; line keys ⊇ `AH half line, OU quarter line, 1X2, CORNER_AH half line`; promptVersion single key
  `before the first saved version`; rule `price` follows settled 1 / wins 0 and breaks settled 3 / wins 2; rule
  `market` breaks null; rule `all` follows null; `&result=WIN` gives the same total; `text` contains "SELECTION RULES"
  and "Price above 1.65 and at most 1.90: followed". `bandSqlMatchesThePromptsBoundaries`: evaluate
  `Bands.sql` in Postgres for 1.65 → "1.65 or lower", 1.651 → "1.66-1.80", 1.90 → "1.81-1.90", 2.06 → "above 2.05",
  edge 0 → "0 or below", 0.10 → "0.05 to 0.10", probability 0.5999 → "0.55-0.59", 0.60 → "0.60-0.64".
  `emptyFiltersStillRender`: a provider without picks → total settled 0, winRate null, text contains "No settled picks".
  TRACK RECORD: `/prompts/{AI_PREDICTION}/for-agent` contains "By your edge over the market".
- [ ] **Step 2: Run** `mvn -B -Dtest=none -Dsurefire.failIfNoSpecifiedTests=false -Dit.test=PromptTuningIT verify` → FAIL (404).
- [ ] **Step 3: Implement** `PromptTuningService.report(Filters)`: settled scope `r.result IS NOT NULL AND r.result <> 'PENDING'`,
  one `SELECT <key>, AGG, avg(q) … GROUP BY 1 ORDER BY <order>` per dimension (bands ordered by `min(expr)`, prompt
  version via a `LEFT JOIN LATERAL` only in its query), one query per rule (`CASE WHEN cond THEN 'follows' ELSE 'breaks'`),
  goals from finished simulated predictions; controller method `promptTuning(Filters)`.
- [ ] **Step 4: Run** the IT → PASS; add the API doc row and the sample.

### Task 5: Web "Prompt tuning" tab

**Files:**
- Modify: `matchmind-web/src/app/core/models.ts`, `matchmind-web/src/app/core/api.service.ts`,
  `matchmind-web/src/app/pages/reports.ts`, Test: `matchmind-web/src/app/pages/reports.spec.ts`

**Interfaces:**
- Produces: `TuningCounts = PerformanceCounts & { avgMarketProbability: number | null }`,
  `TuningRow extends TuningCounts { key: string }`, `PromptTuningReport { total; rules: TuningRule[]; dimensions: TuningDimension[]; goals; text }`;
  `ApiService.promptTuning(f: Filters)`.

- [ ] **Step 1: Write spec** `describe('ReportsPage Prompt tuning')`: renders KPIs (win rate, ROI), the rule table
  (followed / broken, `—` for a null side), one table per dimension titled by `title`; "Copy for AI agent" calls
  `CopyService.copy(report.text, 'Prompt tuning report')`.
- [ ] **Step 2: Run** `cd matchmind-web && npx ng test --watch=false --include=src/app/pages/reports.spec.ts` → FAIL.
- [ ] **Step 3: Implement** tab `tuning` ("Prompt tuning") with an `rxResource` active only on that tab.
- [ ] **Step 4: Run** the spec → PASS, then `npx ng build`.

### Task 6: Sheet script GOALS tab, scoring and report

**Files:**
- Modify: `docs/google-sheet/MatchMind.gs`, Test: `docs/google-sheet/MatchMind.test.mjs`

**Interfaces:**
- Produces: `GOALS_COLUMNS` (29 names, spec order), `goalOutcome(row) → [ngResult, bttsResult]`,
  `goalsReport()`, `goalsReportTable(rows, now) → string[][]` (rectangular), menu "Goals report", hourly trigger.
- Price bands (sheet): ≤1.50, 1.51-1.70, 1.71-1.90, 1.91-2.10, 2.11-2.30, above 2.30; edge bands: unknown, 0 or below,
  0 to 0.03, 0.03 to 0.06, 0.06 to 0.10, above 0.10.

- [ ] **Step 1: Write tests**: `goalOutcome scores first scorer and BTTS, voids, and flags contradictions` (HOME/HOME
  WIN, AWAY pick LOSS, NONE 0-0 NO_GOAL WIN, YES at 1-1 WIN, NO at 2-0 WIN, VOID → VOID for bets, NO_BET → '',
  lower-case `home` scored, HOME at 0-2 → `check: …`, NONE at 1-0 → `check: …`, empty firstGoal → `['', '']`);
  `goalsReport writes results once and a report the prompt can read` (comma odds parsed; second run writes nothing;
  GOALS_REPORT has `NEXT_GOAL HOME` with picks/wins, FAVOUR/AVOID lines; no `UrlFetchApp` call);
  `sendPending never sends GOALS rows`; setup test extended (GOALS header 1,1,1,29, `A:AC` plain text, GOALS_REPORT,
  `goalsReport` hourly).
- [ ] **Step 2: Run** `node --test docs/google-sheet/MatchMind.test.mjs` → FAIL.
- [ ] **Step 3: Implement**; header comment documents the GOALS flow.
- [ ] **Step 4: Run** → PASS.

### Task 7: V44 prompts and `{{PROMPT_VERSION}}`

**Files:**
- Create: `matchmind-api/src/main/resources/db/migration/V44__next_goal_btts_sheet_prompt.sql`
- Modify: `matchmind-api/src/main/java/com/matchmind/prompt/PromptController.java`
- Test: `matchmind-api/src/test/java/com/matchmind/it/PromptTemplatesIT.java`; Modify `docs/API_DOCUMENTATION.md`
  (prompt placeholders, default templates)

**Interfaces:**
- Consumes: `GOALS_COLUMNS` from Task 6 (the IT reads `MatchMind.gs`).
- Produces: template `AI Next Goal & BTTS Prompt` / `AI_NEXT_GOAL_BTTS`; settlement prompt section `THE GOALS TAB`;
  `PromptController.PROMPT_VERSION_PLACEHOLDER = "{{PROMPT_VERSION}}"` replaced in every `for-agent` copy.

- [ ] **Step 1: Write IT tests**: `nextGoalBttsPromptWritesOnlyTheGoalsTabInTheScriptsColumnOrder` (script has
  `const GOALS_COLUMNS = [...]`; prompt has "Columns in this order: <29 names>.", "1000", "NO_BET", "GOALS_REPORT",
  "QUEUED_IN_SHEET", no "/api/v1/external", no "X-Api-Key"); `forAgentFillsThePromptVersion` (no
  `{{PROMPT_VERSION}}`, contains `promptVersion: <version>`, sheet link filled);
  `sheetSettlementPromptAlsoFillsGoalsResults` ("THE GOALS TAB", "firstGoal, homeScore, awayScore and resultSource",
  still "tab named SETTLE").
- [ ] **Step 2: Run** `mvn -B -Dtest=none -Dsurefire.failIfNoSpecifiedTests=false -Dit.test=PromptTemplatesIT verify` → FAIL.
- [ ] **Step 3: Implement** V44 (INSERT … WHERE NOT EXISTS; UPDATE settlement with `replace()` on fixed anchors,
  `version + 1`, guarded by `position('THE GOALS TAB' IN content) = 0`) and the placeholder.
- [ ] **Step 4: Run** → PASS.

### Final verification

- [ ] `cd matchmind-api && mvn -B verify` (unit + all ITs, Docker).
- [ ] `node --test docs/google-sheet/MatchMind.test.mjs`.
- [ ] `cd matchmind-web && npx ng test --watch=false && npx ng build`.
- [ ] GitNexus `detect_changes({scope: "all"})` matches the tasks above.
