# Win/loss patterns report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Reports tab that shows which pick attributes win or lose significantly more than overall.

**Architecture:** One SQL query in `ReportService.patterns` unpivots each pick into (factor, value) pairs with
`CROSS JOIN LATERAL (VALUES …)` and aggregates with the shared `AGG`; Java adds rates, lift, z and signal. The web
tab renders it from one resource.

**Tech Stack:** Java 25 / Spring Boot 3.5 / PostgreSQL 17 (JDBC); Angular 22 signals.

**Spec:** `docs/superpowers/specs/2026-11-28-win-loss-patterns-report-design.md`

## Global Constraints
- Same filters, count policy and `Stats.winRate`/`Stats.roi` as the other reports. Rates are `BigDecimal`.
- No user input in SQL; `minSample` is a bound parameter only used in Java (clamped 1..1000, default 20).
- UI: missing numbers render `—`; errors show the API `message`; full-width dense table.
- API change ships with `core/models.ts`, `core/api.service.ts`, `docs/API_DOCUMENTATION.md`, `docs/samples/report-patterns.json`.

## Review Focus
- No settled picks: overall winRate null → every lift/z/signal null, no division by zero (unit test).
- Overall winRate 1 or 0 (all wins/losses): p0(1−p0)=0 → z null (unit test).
- PRE_MATCH picks must not appear under `minute`/`scoreState` (IT asserts LIVE-only rows).
- Picks with NULL price (should not happen, CHECK > 1) or NULL line: skipped, not a "null" value row (IT: 1X2 has no `line` row).
- `minSample` out of range (0, 5000, non-numeric): clamped / 400 by Spring, never 500.

---

### Task 1: API `GET /api/v1/reports/patterns`

**Files:**
- Modify: `matchmind-api/src/main/java/com/matchmind/report/ReportService.java` (new section after `typeComparison`)
- Modify: `matchmind-api/src/main/java/com/matchmind/report/ReportController.java`
- Test: `matchmind-api/src/test/java/com/matchmind/report/PatternSignalTest.java`, `matchmind-api/src/test/java/com/matchmind/it/PatternsReportIT.java`

**Interfaces:**
- Produces: `Map<String,Object> ReportService.patterns(Filters f, Integer minSample)` →
  `{overall, minSample, rows:[{factor, value, …AGG, winRate, roi, lift, z, signal}]}`;
  `static void ReportService.addSignal(Map<String,Object> row, BigDecimal baseline, int minSample)`.

- [ ] Step 1: unit test `addSignal`: baseline 0.5, wins 10 losses 30 (n 40, p .25, z −3.16) → signal WARNING, lift −0.25;
  wins 30 losses 10 → STRENGTH; wins 3 losses 9 with minSample 20 → signal null but z set; baseline null → lift/z/signal null;
  baseline 1 → z null.
- [ ] Step 2: run `mvn -q -Dtest=PatternSignalTest test` → FAIL (method missing).
- [ ] Step 3: implement `addSignal` (z = lift / sqrt(p0(1−p0)/n), `BigDecimal.sqrt(MathContext.DECIMAL64)`, z scale 2) and `patterns`.
- [ ] Step 4: unit test passes.
- [ ] Step 5: IT: one LIVE prediction (AH HOME rank 1 WIN, OU OVER rank 2 LOSS, minute 55, 1-0) + one PRE_MATCH
  (1X2 + CORNER_AH) filtered by provider. Assert overall picks 4; rows include `side`/`AH HOME`, `minute`/`46-60`,
  `scoreState`/`Pick side leading` (AH HOME), `scoreState`/`Not level` (OU OVER); `minute` rows only count 2 picks;
  no `line` row for 1X2; `minSample` echoes clamp (0 → 1).
- [ ] Step 6: `mvn -B verify -Dit.test=PatternsReportIT` (needs Docker).

### Task 2: Web tab "Win/loss patterns"

**Files:** `matchmind-web/src/app/core/models.ts`, `core/api.service.ts`, `pages/reports.ts`, `pages/reports.spec.ts`

**Interfaces:**
- Consumes: Task 1 response.
- Produces: `PatternsReport`, `PatternRow` types; `ApiService.patterns(f: Filters, minSample?: number)`.

- [ ] Step 1: spec case: tab `patterns` renders a Watch out row for a WARNING, a Strengths row for a STRENGTH, `—` for null winRate.
- [ ] Step 2: run `npx ng test --watch=false --include=src/app/pages/reports.spec.ts` → FAIL.
- [ ] Step 3: add types, api call, tab, resource (`params` only when tab is `patterns`), template: KPI strip, two lists, factor select + table.
- [ ] Step 4: spec passes; `npx ng build`.

### Task 3: Docs
- [ ] `docs/API_DOCUMENTATION.md` section after type-comparison; `docs/samples/report-patterns.json`.
