# Win/loss patterns report — design (short)

## Intent
Show the owner what winning picks have in common and what losing picks have in common, so they know which kinds of
pick to trust and which to be wary of (e.g. "AH AWAY while trailing: 31% vs 52% overall").

## Goals / non-goals
- Goal: one Reports tab "Win/loss patterns": overall KPIs, a "Watch out" list (significantly worse than overall), a
  "Strengths" list (significantly better), and the full factor table.
- Non-goal: feeding the result into the prediction prompt (`prompt/TrackRecord` already does a smaller version of
  that), multi-factor combinations, AI-written summaries.
- Anti-goal: numbers that disagree with the other reports. Same filters, count policy and win-rate/ROI formulas.

## Approaches
- **A. Factor table vs overall, flagged by significance (picked).** One SQL query unpivots each pick into
  (factor, value) pairs and aggregates with the shared `AGG`. Deterministic, cheap, all filters apply.
- B. LLM summary of losing picks: non-deterministic, costs per view, hard to verify. Dropped.
- C. Two/three-factor combinations (decision tree): overfits small samples. Later, if A proves too coarse.

## Design
API (`report` package): `GET /api/v1/reports/patterns?minSample=` (default 20, clamped 1..1000) + shared `Filters`.

Factors (value NULL = pick not in that factor, skipped):
`market`, `side` (market + pick), `type`, `stage` (odds stage), `league`, `model`, `rank` (1, 2, 3+),
`probability` (<40%, 40-50%, 50-60%, 60-70%, 70%+), `price` (same bands as `TrackRecord.priceBand`),
`line` (market + line, when the odds have a line), `minute` (LIVE only: 0-15 … 76+),
`scoreState` (LIVE only: Level / Pick side leading / Pick side trailing / Not level for OU/DRAW picks).

Response: `{ overall: AGG+winRate+roi, minSample, rows: [{factor, value, AGG…, winRate, roi, lift, z, signal}] }`.
- `lift` = row winRate − overall winRate. `z` = lift / sqrt(p0(1−p0)/n), n = wins + losses (decisive).
- `signal` = `WARNING` when n ≥ minSample and z ≤ −1.96, `STRENGTH` when z ≥ 1.96, else null.
  `lift`/`z`/`signal` null when either rate is null or p0 is 0 or 1.
- Rows ordered by factor (list order above), then picks desc, then value.

Web (`pages/reports.ts`): tab `patterns`, resource active only on that tab. KPI strip from `overall`; two dense
lists (Watch out sorted by z asc, Strengths by z desc); full table with a factor select. Missing numbers `—`.

Docs: `docs/API_DOCUMENTATION.md` section + `docs/samples/report-patterns.json`.
Tests: unit test of the signal/z logic; one IT (rows per factor, LIVE-only factors, minSample validation); a
`reports.spec.ts` case for the tab.

## Left to the builder
Exact labels, column hiding on phones.
