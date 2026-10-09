# Investment reports

`GET /api/v1/investment/reports/{type}` (authenticated, read-only). Only `COMPLETED` transactions of the caller are used; rows are never mixed across currencies.

Query: `fromDate`, `toDate` (ISO dates, inclusive, max 5 years; defaults differ per type), `accountId` (optional, must belong to the caller → otherwise `404 INVESTMENT_ACCOUNT_NOT_FOUND`), `granularity` (`periodic` only: `DAY|WEEK|MONTH|QUARTER|YEAR`), `compareFromDate` + `compareToDate` (`comparison` only, must be sent together; default is the immediately preceding window of equal length). Unknown `type` → `404 INVESTMENT_REPORT_TYPE_NOT_FOUND`; bad range/granularity → `400 INVALID_REPORT_RANGE | REPORT_RANGE_TOO_LARGE | INVALID_REPORT_GRANULARITY`.

Response envelope: `{type, fromDate, toDate, timeZone, accountId, currencies: [{currency, data}]}`. Days/hours use the server time zone (`investment.transaction-import.time-zone`, default `Asia/Ho_Chi_Minh`).

Definitions: **net = withdrawals − deposits** (same as the statistics page); `netWithBonus = net + bonuses`. Percentages are `null` when the baseline is zero.

| type | default range | `data` highlights |
| --- | --- | --- |
| `overview` | 365d | headline totals, payback %, average transaction, active accounts/days, first/last transaction, current vs previous month (`monthNetChange` computed by the API), best/worst account |
| `matrix` | 365d | account × calendar-month net table with per-account and per-month totals; `cumulative` (per account) and `cumulativeTotals` give the running view |
| `drawdowns` | 365d | up to 20 deepest drawdown episodes (peak, start, trough, recovery, depth, days to trough/recover, duration in days spent below the peak) plus count, longest, deepest and whether one is ongoing |
| `cadence` | 365d | per account: average and longest gap between transactions, average days from the latest deposit to each withdrawal |
| `periodic` | 365d | one row per day/week/month/quarter/year in the range, empty periods included (so change % compares adjacent periods and the average divides by every period): totals, cumulative net, change %, best/worst, win/loss periods |
| `accounts` | 365d | per account: totals, ROI %, share of net, average deposit/withdrawal, last activity, days since last |
| `equity` | 90d | per-day cumulative net, peak, drawdown; max/current drawdown, best/worst day, win/loss days, streaks |
| `rolling` | 90d | per-day 7/30-day rolling net, best/worst 7-day window, average daily net, volatility (sample σ of daily net, inactive days included) |
| `daily` | 90d | active days with totals, best/worst, averages (rendered as a calendar) |
| `activity` | 90d | weekday × hour count matrix, totals by weekday, hour and day of month, busiest weekday/hour/day of month |
| `distribution` | 90d | per type min/max/avg/median/p90, 8-bucket size histogram, top 10 largest |
| `bonus` | 365d | bonus % of deposits, average/largest, by month, by account |
| `ledger` | 30d | newest-first rows with running net (capped at 1000, `truncated` flag) |
| `allocation` | 5y | capital at risk per account (deposits not yet withdrawn, never negative), its share of the total and of deposits, HHI (Σ share², 0–10000) with band DIVERSIFIED < 1500 ≤ MODERATE < 2500 ≤ CONCENTRATED; `NONE` when nothing is outstanding |
| `lots` | 5y | FIFO capital lots: each deposit is a lot repaid by withdrawals oldest-first (bonuses excluded); per-lot recovery date/days, average days to recover, outstanding capital aged 0-30 / 31-90 / 91+ days (200 newest lots returned, `truncated` flag) |
| `payback` | 5y | per account recovered % (= withdrawals ÷ deposits), outstanding, break-even date and days. Break-even is a current state: it is cleared if later deposits push the account back to outstanding; bonuses are not counted as recovered cash |
| `seasonality` | 730d | per calendar month: occurrences, winning years, total/average net |
| `projection` | as of `toDate` | run-rate estimate: month-to-date, daily run-rate (trailing 30 calendar days ÷ min(30, days since the user's first transaction)), projected month-end / next 30d / year. `fromDate` is ignored (windows are always measured at `toDate`). An estimate, not a forecast |
| `performance` | 365d | per-day net statistics: win rate, gross win/loss, average win/loss, payoff ratio, profit factor, expectancy, median, largest win/loss, max drawdown, recovery factor (ratios `null` when the denominator is 0) |
| `insights` | 90d window, 365d history | rule-based observations with a `code`, `severity` (`WARN`/`INFO`/`GOOD`), optional account/value/date: dormant account (≥30d), no activity (≥14d), losing/winning streak (≥3 active days), drawdown ≥25% of peak, negative/positive month, transaction ≥3× the average of its type in the last 7 days. Dormancy/idle checks look 365 days back; streak, drawdown and anomaly rules use only the window; streaks that ended more than 7 days ago are not reported |
| `goals` | calendar year to `toDate`; `accountId` is validated (404 if foreign) but not applied | progress of net toward the user's goals for the month/year containing `toDate`: achieved, %, elapsed %, remaining, needed per day, on-track / reached |
| `comparison` | 30d | selected period vs the immediately preceding period of equal length, deltas and % |

Clients: web `/app/investment/reports` (Angular, CSV export on periodic/accounts/ledger), mobile `investment-analytics` page (Investment → Báo cáo).

## Goals

Net-profit targets per currency and period (`MONTH` or `YEAR`), one per `(user, currency, period)` (table `investment_goals`, migration `V36`).

- `GET /api/v1/investment/goals` → `[{id, currency, period, targetAmount}]`
- `PUT /api/v1/investment/goals` `{currency (3 letters), period: MONTH|YEAR, targetAmount > 0}` → upsert, returns the goal. The user must own a non-deleted investment account in that currency (`400 INVALID_GOAL_CURRENCY`) and may hold at most 20 goals (`400 TOO_MANY_GOALS`).
- `DELETE /api/v1/investment/goals/{id}` → `204`, or `404 INVESTMENT_GOAL_NOT_FOUND` for another user's goal

`goals` report: goals belong to the user and currency, so progress always spans every account. *on track* means achieved % ≥ elapsed % of the period. A currency that has goals but no transactions is still returned.

## Admin summary

`GET /api/v1/admin/investment/reports/summary?fromDate&toDate` (ROLE_ADMIN via `/api/v1/admin/**`; default last 365 days, max 5 years). Pure SQL aggregation over completed transactions of all users, per currency (busiest first; the top-10 ranking is a MySQL window function, and zones with daylight saving are bucketed per calendar month): `totals` (transactions, distinct users/accounts, deposits, withdrawals, bonuses, net), `months` (`YYYY-MM` in the server time zone) and `topUsers` (10 by deposits + withdrawals, with email and full name). Web: `/app/admin/investment-reports`; mobile: `admin-investment-summary` (button on the admin reconciliation screen).

## Performance note

Reports load the user's completed transactions for the requested range into memory and compute in Java (ranges are capped at 5 years). Measured on a throwaway MySQL 8 with 200,000 transactions for one user over 5 years: every report returned in under 2 seconds (most ≈ 0.7 s).
