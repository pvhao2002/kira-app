# Next Goal & BTTS sheet prompt, and prompt-tuning reports

Date: 2026-11-27. Status: decided by the agent under `/goal` (no question rounds); the calls marked *(call)* are open
to correction.

## Intent

1. The user screenshots a match **before kick-off** with the **Next Goal** (first goal: home / no goal / away) and
   **BTTS** (yes / no) odds. An AI agent runs **1000 Monte Carlo simulations**, picks value bets and writes **one row
   to the Google Sheet**. The rows stay in the sheet: MatchMind's API never receives them ("ko cần pull về backend").
2. The win rate of MatchMind's predictions is very low. Give the AI agents the reports they need to tune the prompt:
   the agent that predicts (the prompt's TRACK RECORD) and an agent asked to rewrite the prompt (a full report it can
   read in one paste).

## Goals

- A new prompt template `AI_NEXT_GOAL_BTTS` (Flyway seed) that delivers only to a new `GOALS` tab.
- The sheet script creates `GOALS` and `GOALS_REPORT`, never sends `GOALS` rows anywhere, scores a row once its
  result is filled in, and writes a summary to `GOALS_REPORT` that the prompt tells the agent to read first.
- The existing **AI Sheet Settlement Prompt** also fills in the results of `GOALS` rows (first scorer and score).
- `GET /api/v1/reports/prompt-tuning`: settled picks grouped every way a prompt rule can act on, plus a check of the
  prompt's current SELECTION RULES (followed vs broken) and a plain-text rendering for an AI agent. A **Prompt tuning**
  tab on the Reports page shows it and copies the text ("Copy for AI agent").
- TRACK RECORD (in the prediction prompt) adds the agent's **edge over the market**, the strongest losing signal found
  on 2026-11-25 (picks rated far above the market won 20%).

## Non-goals / anti-goals

- No NEXT_GOAL / BTTS market in the API, the settlement engine or the database.
- No automatic prompt rewriting: the report informs; a person or agent edits the prompt.
- No API-key access to reports (admin JWT only, as every report).
- Anti-goal: anything that sends `GOALS` rows to the API or puts a key into a prompt.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| A | **Sheet-only goals + SQL tuning report** *(chosen)* | Matches "sheet only"; the goals report lives where the data is (Apps Script, tested with the existing node harness). Backend report reuses `PICKS_FROM`/`AGG`. |
| B | Ingest NEXT_GOAL / BTTS into the API (new markets, engine rules) | Full reports in one place, but the user said not to pull them into the backend; large engine + schema change. |
| C | Only enrich TRACK RECORD (no new report) | Smallest, but an agent asked to *rewrite* the prompt still has no rule check, prompt-version view or calibration by group. |

## Design

### 1. `AI_NEXT_GOAL_BTTS` prompt (V44)

Placeholders: `{{MATCHMIND_SHEET_URL}}` and a new `{{PROMPT_VERSION}}` (filled by `GET /prompts/{id}/for-agent`
with the template's version, for every template), so each `GOALS` row records which prompt version made it.

Steps the prompt gives the agent:
1. **Track record**: read `GOALS_REPORT`; lower probabilities by the "too sure" points; skip AVOID groups unless the
   edge is at least 0.08; prefer FAVOUR groups on near-ties.
2. **Expected goals (λ)**: market view from Next Goal without margin (`λtotal = −ln q_NO_GOAL`, split by
   `q_HOME : q_AWAY`), checked against BTTS; own view from form/news; **final λ = 0.6 market + 0.4 own** *(call: the
   2026-11-25 data says big disagreements with the market lose)*.
3. **1000 simulations** with a fixed seed (a short Python snippet is in the prompt): Poisson goals per team, goal
   minutes uniform over 90', first scorer = earliest goal, BTTS = both scored. Without code execution: the exact
   Poisson formulas and `simulations = 0`, never a made-up count.
4. **Picks**, at most one per market, highest value `p × price − 1` that passes: price above 1.50 and at most 2.30,
   `p ≥ 0.50`, edge `p − q ≥ 0.03`; edge above 0.10 only with a named reason. Otherwise `NO_BET` *(call: initial
   thresholds, tuned later from `GOALS_REPORT`)*.
5. **One row** in `GOALS` (one row per match per provider; a second copy replies `ALREADY_IN_SHEET`), then the line
   `QUEUED_IN_SHEET`; without sheet access `CANNOT_WRITE_SHEET` plus the row as tab-separated values.

`GOALS` columns (the script and both prompts list them in this order; a test checks it):
`league, homeTeam, awayTeam, kickoffGmt7, provider, model, promptVersion, ngHomeOdds, ngNoGoalOdds, ngAwayOdds,
bttsYesOdds, bttsNoOdds, lambdaHome, lambdaAway, simulations, pNgHome, pNgNoGoal, pNgAway, pBttsYes, ngPick, bttsPick,
notes` (agent) · `firstGoal, homeScore, awayScore, resultSource` (settlement agent) · `ngResult, bttsResult,
settledAt` (script).

### 2. Settlement of `GOALS` rows (V44, same migration)

The AI Sheet Settlement Prompt works in `SETTLE` and `GOALS`. For `GOALS` rows whose kick-off is over 2 h 30 ago it
fills `firstGoal` (HOME / AWAY / NONE for 0-0 / VOID when not played; own goals count for the team credited),
`homeScore`, `awayScore` (90' + stoppage) and `resultSource`. `replace()` on fixed anchors, so admin edits are kept.

### 3. Sheet script

- `setup()` adds `GOALS` (header, plain text) and `GOALS_REPORT`, and an hourly `goalsReport` trigger; menu item
  "Goals report".
- `goalsReport()` (script lock): scores each row whose `firstGoal` is filled — `WIN`/`LOSS`/`VOID` per pick, nothing
  for `NO_BET`, `check: …` when the result is inconsistent (e.g. HOME with home score 0) — writing only changed cells
  after checking the row did not move; then rewrites `GOALS_REPORT`: by market, market and pick, price band, edge
  band, prompt version and model — picks, wins, losses, win rate, units, ROI, stated vs market probability, "too sure"
  points — and FAVOUR (≥ 60 %, n ≥ 6) / AVOID (< 45 %, n ≥ 6). `sendPending` and `cleanupOldRows` never read `GOALS`.

### 4. `GET /api/v1/reports/prompt-tuning` (admin)

Shared filters (`result` ignored: the report is about settled picks), latest-count policy as every report. Scope:
settled picks. Response `{total, dimensions[{by, title, rows}], rules[{rule, text, follows, breaks}], goals, text}`;
each row is a breakdown row plus `avgMarketProbability`.

Dimensions: rank, market and side, price band, edge band (`p − q`), stated probability band, line type
(whole / half / quarter), match minute, score margin at prediction, **prompt version in force when the prediction was
made** (latest `prompt_template_versions` row of an `AI_PREDICTION` template saved before `predicted_at`), model,
league. Rules: the V42 SELECTION RULES (price window 1.66–1.90, rank 2 only at p ≥ 0.60, at most 0.10 above the
market, all three). `goals`: expected vs actual goals after the prediction (finished simulated predictions).

`q` = the bookmaker probability of the pick without margin, from the pick's own snapshot: `Sql.MARKET_PROBABILITY`.
Bands are defined once (`shared/Bands`) and rendered as SQL `CASE`, used by both this report and TRACK RECORD.
`text` is rendered by a pure function (unit-tested): rules first, then one line per group with win rate, n, ROI,
stated vs market and a calibration note, then FAVOUR / AVOID (n ≥ 6).

### 5. TRACK RECORD

Same text plus "By your edge over the market", and edge bands take part in FAVOUR / AVOID. Its price bands come from
`Bands` (SQL) instead of a Java copy; the half-win counting of TRACK RECORD is unchanged.

### 6. Web

Reports tab **Prompt tuning**: KPI row, rule table (followed vs broken), one compact table per dimension, "Copy for
AI agent" (the `text`, through `CopyService`). `core/models.ts`, `api.service.ts`, API docs and
`docs/samples/report-prompt-tuning.json` change together.

## Verification

Unit: `BandsTest`, `PromptTuningTextTest`, `TrackRecordTest`. IT: `PromptTuningIT` (numbers on seeded picks, band SQL,
400s), `PromptTemplatesIT` (goals prompt columns = script, settlement goals section, `{{PROMPT_VERSION}}` rendered).
Sheet: `node --test docs/google-sheet/MatchMind.test.mjs`. Web: `ng test` (reports spec) and `ng build`.

## Left to the builder

Copy of the prompt texts, report table layout details, exact band labels.
