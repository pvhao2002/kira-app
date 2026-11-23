# Pre-match vs Live report — design (short)

## Intent
Compare PRE_MATCH and LIVE predictions side by side on the Reports page, so the owner can see whether LIVE picks
beat pre-match picks, overall and per model / market / league.

## Goals / non-goals
- Goal: one new Reports tab "Pre-match vs Live" with both types' pick stats in one row per group, plus the difference.
- Non-goal: pairing the same match/model before and after kickoff (approach B). May come later as a "paired only" toggle.
- Anti-goal: numbers that disagree with the other reports. Same filters, same count policy, same win-rate/ROI formulas.

## Approaches
- **A. Totals side by side, grouped by model/market/league (picked).** One SQL query, all existing filters apply.
  Trade-off: the two types may cover different matches, so it is not strictly like-for-like.
- B. Paired by match: fairer, fewer rows, harder query, needs a rule for which LIVE minute counts.
- C. Only the two totals from `breakdown?by=type`: no backend work, but cannot show which model/market changes.

## Design
API (`report` package):
- `GET /api/v1/reports/type-comparison?by=model|market|league` (default `model`), shared `Filters`.
- The `type` filter is ignored (the report always shows both types); every other filter and the count policy apply.
- SQL: the existing `PICKS_FROM` + `AGG`, `GROUP BY key, p.prediction_type`; whitelisted `by` like `breakdown`
  (`INVALID_GROUP` on anything else). Pivot in Java to
  `{ key, preMatch: {AGG + winRate + roi} | null, live: {…} | null, winRateDelta, roiDelta }`.
  Delta = live − preMatch as `BigDecimal`, `null` when either side is missing or has no rate.
- Rows ordered by total picks desc, then key. Not paged (same as `breakdown`).

Web (`pages/reports.ts`):
- New tab `typecompare` "Pre-match vs Live", a resource that runs only while the tab is active (like the others).
- KPI strip: overall PRE_MATCH vs LIVE from the existing `breakdown?by=type` (picks, win rate, units, ROI).
- Group-by select (Model / Market / League), dense full-width table:
  `Key | PRE picks, WR, units, ROI | LIVE picks, WR, units, ROI | Δ WR, Δ ROI`. Missing numbers render `—`.
  Δ coloured positive/negative using the existing tag/text classes.
- `core/api.service.ts` + `core/models.ts` gain the call and type.

Docs: `docs/API_DOCUMENTATION.md` section + `docs/samples/report-type-comparison.json`.

Tests: one IT (both types counted, `type` filter ignored, `INVALID_GROUP`, delta null when a side is missing) and a
`reports.spec.ts` case for the new tab rendering and `—`.

## Left to the builder
Column hiding on phones, exact labels, chart (none planned).
