# Edge-Gated Selection Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The prediction prompt picks only with a real edge over the market, and TRACK RECORD / the prompt-tuning report
judge every group against the market with one significance rule.

**Architecture:** One shared definition in `Stats` (per-pick hit `(1 + profit) / price`, its aggregate, and
`versusMarket`), used by `TrackRecord` (prompt text) and `PromptTuningService`/`PromptTuningText` (report). Prompt text
changes in Flyway `V45` by `replace()` on fixed anchors.

**Tech Stack:** Java 25, Spring Boot 3.5, JDBC, Flyway, PostgreSQL 17, Testcontainers; Angular 22 (vitest).

**Spec:** `MatchMind/docs/superpowers/specs/2026-11-27-edge-gated-selection-rules-design.md`

## Global Constraints

- Verify API: `cd MatchMind/matchmind-api && JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -B verify` (single IT:
  `-Dtest=none -Dsurefire.failIfNoSpecifiedTests=false -Dit.test=XxxIT`; single unit: `-Dtest=XxxTest -DskipITs`).
- Verify web: `cd MatchMind/matchmind-web && NG_CLI_ANALYTICS=false npx ng test --watch=false --include=src/app/pages/reports.spec.ts`.
- Migration: never edit V1–V44; no `${` in the file; LF only; `replace()` + `version = version + 1`.
- API contract changes go together: `docs/API_DOCUMENTATION.md`, `docs/samples/report-prompt-tuning.json`, `core/models.ts`.
- Thresholds: MIN_GROUP 30; two standard errors `2·√(q(1−q)/n)`; edge gate `(stated − market) × price ≥ 0.10` and
  `stated × price − 1 ≥ 0.03`; price window above 1.65, at most 1.90.
- No commits: the user authorises commits separately.

## Review Focus

- V45 anchors that do not match (admin-edited prompt): nothing may change half-way. The WHERE clause requires the whole
  old SELECTION RULES block; Task 4's IT asserts the seeded prompt has the new text and none of the old.
- A row with no decisive pick: `hitRate` is null and no text prints "null" (Task 3, existing nothing-settled tests).
- Quarter lines: HALF_WIN / HALF_LOSS hit values (Task 3 IT with a 1-1 final on OU 2.25).
- The LIVE example's new `stats.extra` must pass strict binding (Task 4: `bothPromptExamplesAreAcceptedByTheApi`).
- A prediction with one pick, or rank 2 in rank 1's market (Task 3 IT: `rank2` follows / breaks).

---

### Task 1: Shared hit rate and market test in `Stats`

**Files:**
- Modify: `matchmind-api/src/main/java/com/matchmind/shared/Stats.java`
- Test: `matchmind-api/src/test/java/com/matchmind/shared/SharedHelpersTest.java`

**Interfaces:**
- Produces: `Stats.PICK_HIT` (SQL, per pick, aliases pk/o/r: `(1 + (PICK_UNITS)) / (Sql.PRICE)`),
  `Stats.HIT_RATE` (SQL aggregate: `round(avg(PICK_HIT) FILTER (WHERE r.result IN ('WIN','HALF_WIN','HALF_LOSS','LOSS')), 4)`),
  `Stats.MIN_GROUP = 30`, `static int versusMarket(long n, double hit, double market)` → `1` beats, `-1` trails, `0`.

- [ ] **Step 1: failing test** `versusMarketNeedsThirtyPicksAndTwoStandardErrors`:
  `versusMarket(29, 0.90, 0.50) == 0`, `(30, 0.70, 0.50) == 1`, `(30, 0.68, 0.50) == 0`, `(100, 0.39, 0.50) == -1`,
  `(100, 0.41, 0.50) == 0`.
- [ ] **Step 2:** run `-Dtest=SharedHelpersTest -DskipITs` → compile failure (no `versusMarket`).
- [ ] **Step 3:** implement the four members (javadoc: why hit = what the pick paid back per unit of price).
- [ ] **Step 4:** rerun → PASS.

### Task 2: TRACK RECORD against the market

**Files:**
- Modify: `matchmind-api/src/main/java/com/matchmind/prompt/TrackRecord.java`
- Test: `matchmind-api/src/test/java/com/matchmind/prompt/TrackRecordTest.java`

**Interfaces:**
- Consumes: `Stats.PICK_HIT`, `Stats.MIN_GROUP`, `Stats.versusMarket`, `Sql.MARKET_PROBABILITY`.
- Produces: `record Pick(int rank, String side, String type, double prob, double market, String price, String edge, double won)`;
  `static String format(List<Pick>)`.

- [ ] **Step 1: failing test** `judgesEveryGroupAgainstTheMarket`. Fixture: 40 × (1, "AH HOME", "LIVE", 0.62, 0.50,
  "price 1.81-1.90", "edge 0.05 to 0.10", 30 won 1 / 10 won 0); 40 × (1, "OU UNDER", "PRE_MATCH", 0.56, 0.52,
  "price 1.66-1.80", "edge 0 to 0.05", 14 won 1 / 26 won 0); 10 × (2, "1X2 HOME", "PRE_MATCH", 0.70, 0.60,
  "price 1.66-1.80", "edge 0.10 to 0.15", won 1). Assert contains:
  - `"- rank 1: hit 55% of 80; you said 59% (4 points too sure); market 51% -> no proven edge over the market."`
  - `"- rank 2: hit 100% of 10; you said 70% (30 points too cautious); market 60% -> too few picks to judge against the market."`
  - `"- By market and side: 1X2 HOME 100% vs market 60% (n 10) · AH HOME 75% vs market 50% (n 40) · OU UNDER 35% vs market 52% (n 40)"`
  - `"- By price: price 1.66-1.80 48% vs market 54% (n 50) · price 1.81-1.90 75% vs market 50% (n 40)"`
  - `"- FAVOUR (beat the market by more than two standard errors, at least 30 picks): AH HOME 75% vs market 50% (n 40) · price 1.81-1.90 75% vs market 50% (n 40) · edge 0.05 to 0.10 75% vs market 50% (n 40)"`
  - `"- AVOID (trailed the market by more than two standard errors, at least 30 picks): OU UNDER 35% vs market 52% (n 40) · edge 0 to 0.05 35% vs market 52% (n 40)"`
  - doesNotContain `"lower your probabilities"`. Keep `saysSoWhenNothingIsSettledYet`.
- [ ] **Step 2:** run `-Dtest=TrackRecordTest -DskipITs` → compile failure (Pick arity).
- [ ] **Step 3:** SQL selects `Sql.MARKET_PROBABILITY AS market` and `Stats.PICK_HIT AS won`; `Stat` carries the market
  average; header line explains hit and market; verdict from `versusMarket` (`n < MIN_GROUP` → "too few picks…").
- [ ] **Step 4:** rerun → PASS.

### Task 3: Prompt-tuning report follows V45 and the shared rule

**Files:**
- Modify: `matchmind-api/src/main/java/com/matchmind/report/PromptTuningService.java`,
  `matchmind-api/src/main/java/com/matchmind/report/PromptTuningText.java`, `docs/API_DOCUMENTATION.md`,
  `docs/samples/report-prompt-tuning.json`, `matchmind-web/src/app/core/models.ts`, `matchmind-web/src/app/pages/reports.ts`
- Test: `PromptTuningTextTest.java`, `PromptTuningIT.java`, `matchmind-web/src/app/pages/reports.spec.ts`

**Interfaces:**
- Consumes: Task 1. Produces: every counter row carries `hitRate` (number | null); rule keys unchanged.

- [ ] **Step 1: failing tests.**
  - `PromptTuningTextTest`: `row(...)` gains `hit`; signals need n ≥ 30 (e.g. "price 1.66-1.80" 30/10 hit 0.75 market
    0.55 → FAVOUR; "price above 2.05" 8/32 hit 0.20 market 0.45 → AVOID; a 5/1 row stays out). Expect
    `"OVERALL: won 56% of 16, ROI -3.1%, hit 57%, stated 64% (7 points too sure), market 52%"`, the FAVOUR/AVOID headers
    of Task 2, and `doesNotContain("lower the stated probabilities")`.
  - `PromptTuningIT.groupsSettledPicksAndChecksTheSelectionRules`: `rank2` breaks null, follows settled 4; `market`
    follows settled 2 / wins 1, breaks settled 2 / wins 1; `total.hitRate` = 0.5.
  - New `PromptTuningIT.hitRateCountsWhatHalfResultsPaidBack`: LIVE picks rank 1 OU UNDER 2.25 @2.00 p 0.50, rank 2 OU
    OVER 2.25 @1.85 p 0.54, final 1-1 → engine HALF_WIN / HALF_LOSS; `total.hitRate` = 0.5101, `winRate` 0.5;
    `rank2` breaks settled 1.
  - `reports.spec.ts`: fixture rows carry `hitRate`; the Price table shows the Hit value.
- [ ] **Step 2:** run them → FAIL.
- [ ] **Step 3:** RULES: `rank2` "Rank 2 only in another market than rank 1"
  (`pk.pick_rank = 1 OR pk.market IS DISTINCT FROM (rank 1's market)`), `market` "Edge at least 0.10 over the market
  ((stated - market) x price) and expected return at least 0.03 (stated x price - 1)"; COLUMNS add `Stats.HIT_RATE AS "hitRate"`;
  text: legend explains hit, `stats()` prints hit and the gap stated − hit, FAVOUR/AVOID via `Stats.versusMarket`,
  HOW TO USE without "lower the stated probabilities". Docs, sample, `TuningCounts.hitRate`, Hit column + tooltip.
- [ ] **Step 4:** rerun → PASS.

### Task 4: Migration V45, the new SELECTION RULES

**Files:**
- Create: `matchmind-api/src/main/resources/db/migration/V45__prediction_edge_gated_selection_rules.sql`
- Test: `matchmind-api/src/test/java/com/matchmind/it/PromptTemplatesIT.java`

- [ ] **Step 1: failing test** `predictionPromptCarriesSelectionRulesAndTodaysTrackRecord`: content contains
  `"SELECTION RULES - BET ONLY WITH A REAL EDGE"`, `"NO_PICK_NO_EDGE"`, `"NO_PICK_PRICE_OUT_OF_RANGE"`,
  `"probability = (1 + R) / price"`, `"INDEPENDENT DATA"`, `"{{TRACK_RECORD}}"`; doesNotContain `"TO WIN MORE OFTEN"`,
  `"lower yours by that much"`, `"WIN hoặc HALF_WIN"`, `"PRICE FLOOR"`; for-agent doesNotContain
  `"lower your probabilities"`.
- [ ] **Step 2:** run `-Dit.test=PromptTemplatesIT` → FAIL.
- [ ] **Step 3:** V45 replaces: the V42 SELECTION RULES block (a–f) → new a–g per spec; step 7's PRICE FLOOR paragraph;
  step 6 "compute the win probability" → settle every candidate in every iteration; step 3 → move goals only for
  INDEPENDENT DATA; INPUT → optional INDEPENDENT DATA list; LIVE step 5 and PRE_MATCH step 5 (+ their price-floor lines)
  → count outcomes, compute probability/R/edge, select by SELECTION RULES; PRE_MATCH step 4 → adjust for INDEPENDENT
  DATA; LIVE example `stats` gains `"extra": { "xg": …, "dangerousAttacks": … }`. WHERE: `template_type = 'AI_PREDICTION'`,
  old block present, `NO_PICK_NO_EDGE` absent.
- [ ] **Step 4:** rerun `PromptTemplatesIT` and `PromptTuningIT` → PASS.

### Task 5: Verification

- [ ] `mvn -B verify` (all unit + IT) and the reports web spec; GitNexus `detect_changes({scope: "all"})`.
