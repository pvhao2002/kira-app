# AQS Work Summary for CV

Source: 89 AQS tickets with my commits (03/2024 → 09/2026), read from `md-aqs/` and the git diffs.
System: AQS / SB11 – a trading, risk-control and back-office accounting platform for a sportsbook (Soccer, Cricket, Tennis, Baseball…).
Stack seen in the diffs: Java/Spring Boot (services `agent`, `aqs-service`, `bookie-system`), MySQL (native SQL, index tuning), Angular (`aqs-report`, `agent-ui`, `sb18-ui`, `sb18-member-ui`), schedulers/crawlers (`aqs-scheduler`, `scheduled-service`, `molly-gateway`, `mapping`), WebSocket/SSE, Apache POI, Docker.

## 1. Suggested role description (3–4 lines)

Full-stack Developer (Java Spring Boot + Angular) on the AQS/SB11 sportsbook trading and risk platform. Built and maintained real-time bet-monitoring reports (BBT, BBG, SPP, View 1, Position Report), accounting modules (Journal, Ledger, Fund Control, Chart of Accounts), the SB18 site for Traders/Runners, and automation jobs. Optimized SQL and performance, fixed production data issues, and worked directly with business and QC through QAT → STG → PROD cycles.

## 2. CV bullets (pick 6–10)

**Major features**
- Built the **SB18 Trader/Runner site** end to end: separate Angular app, multi-role user management, account configuration (client/sport assignment, runner deal), new Spring services, DB entities, and a WebSocket heartbeat service that marks users online/offline every 30 s. (AQS-5426, AQS-5643)
- Delivered **new BBT report variants** — No.7 BBT, VIP BBT (crown toggle to move smart groups, `is_vip` flag, group-visibility filter) and **F1 Pregame BBT** (config-driven market/placed-time bands, even-odds filter, multi-select Placed Time). Reused the existing BBT components after the first standalone design was reverted. (AQS-5368, AQS-5559, AQS-5715, AQS-5740, AQS-5745)
- Added a **Placed Time (time-to-kickoff) filter** to View 1 (F1, All, K1) with band config stored in DB and validated server-side. (AQS-5739, AQS-5747)
- Built the **Position Report** (Cricket → Soccer/Tennis): S/T inputs, event table layout, mark-all, Tennis detail page with set-by-set odds/liability. Wrote a live-score crawler in `molly-gateway` (LiveScore + Sofascore, scheduled, persisted per set). (AQS-5226, AQS-5230, AQS-5232)
- Implemented **Reversed Team Mapping detection** for event mapping: queue table, 10 s scheduled job using Jaro-Winkler name matching plus an optional AI check, a flashing bell alert in the header with a warning dialog, and a Confirm flow. (AQS-5640, AQS-5757)
- Built the **Pinn PT Level** admin page (drill-down tree PART→CORP→SMA→MA→AG, inline edit, permission) and its change **History** log. (AQS-5612, AQS-5638)
- Built **Fund Control wallet linking**: dialog to link ERC20/TRC20 wallets, plus a rule-driven balance parser (`parse_rule` JSON) in the scheduler so new networks/tokens need only DB config. Changed date-filter and total-per-statement logic per BRD. (AQS-5308, AQS-5706, AQS-5723, AQS-5347)
- Built the **F1 Tax Bets By Group** report (tax and net win/loss per event/market) and extended Cricket Bookmaker market types across Monitor Bets, BBT, BBG, SPP. (AQS-4480, AQS-4631, AQS-4755, AQS-4759)
- Added the **PB Report "Last 10 Days Performance"** dialog (new endpoint, SQL aggregation, FX conversion). (AQS-5482)
- Built **DustBin auto-assignment** for large-stake S1 accounts from Merito callbacks (currency-converted threshold, cached config, 60 s scheduler job). Also removed the obsolete Fair smart-group auto-creation job. (AQS-5573, AQS-5502)
- Added **Old Flow / New Flow** tabs for AQS Soccer orders, with a new legacy-orders endpoint. (AQS-5679)
- Built the **Bookie code protection** feature: `has-data` checks, disabled code fields and an admin-only "correct account" tool. (AQS-5295)
- Made the **Follow Bets report near real-time**: SQL moved to `system_config`, bet-status filter, odds conversion, lower refresh load. (AQS-5078)
- Added **Baseball** to the SB11 account PT% flow and **Accounts26** to the Finance Incharge config. (AQS-5213, AQS-5578)

**Performance / stability**
- Fixed **PROD timeouts** (HTTP 524) in BBT Last 50 Bets by rewriting SQL (index hints, subquery on pre-aggregated last-bet tables) and adding a `league_id` partition to the scheduler job. (AQS-4940)
- Resolved **browser freezes** on SPP pages by replacing very large `<select>` lists with virtual-scroll `ng-select`. Added infinite scroll and capped the initial query for Miss Account. (AQS-5597, AQS-5271)
- Fixed **Excel/PDF export logging users out** by caching Apache POI `CellStyle` per workbook (fixes style explosion on large data). (AQS-5282)
- Tightened date-range limits and added loading states on heavy reports. (AQS-5357)

**Business logic / data quality**
- Fixed financial and odds calculation bugs: ToRisk/ToWin for negative MY odds, Lay-bet odds sign for the new Fair source, HK-odds conversion, odds truncation (not rounding) to 2 decimals, Lay selection display via a configurable resolver. (AQS-5536, AQS-5605, AQS-5478, AQS-5567, AQS-5584, AQS-5572)
- Fixed accounting bugs in Journal/Ledger/Chart of Accounts: ordering of Gain/Loss sub-accounts, zero-amount display, transaction split by timestamp (fixed `performed_date` for batch inserts), Debit/Credit placement for Ledger Currency Translation, wrong UPDATE parameter (parent account name). (AQS-5475, AQS-5685, AQS-5686, AQS-5515, AQS-5512, AQS-4965, AQS-5331, AQS-5511)
- Fixed Transaction Verification, Feed Report grouping, SPP Win/Lose filter counts, BBG stake-size data and Client Balance duplicates. (AQS-5272, AQS-5277, AQS-5692, AQS-5448, AQS-4438)
- Security upgrade: guava 31.1 → 33.1.0 across 4 gateway services. (AQS-4050)

## 3. Usable figures (verified from the data)

- 89 AQS tickets with my commits between 03/2024 and 09/2026 (about 750 of my commits across all tickets in the CSV).
- Worked across at least 20 repos, mainly `aqs-report`, `agent`, `agent-ui`, `molly-gateway`, `aqs-scheduler`, `scheduled-service`, `sb18-*`.
- Largest tickets by commit count: AQS-5368 (46), AQS-5426 (45), AQS-5232 (41), AQS-5559 (35), AQS-5715 (34), AQS-5745 (34).
- Git and Jira contain no performance measurements (ms, %), so do not state improvement numbers unless you measure them yourself.

## 4. Notes before putting this on a CV

- Some tickets include reverted or redone work (AQS-5368 first approach, the Set part of AQS-5357, the SQL branch of AQS-5692). Only describe the final result.
- Some tickets were only merged together with a main ticket (AQS-4755, AQS-4759, AQS-5723…). These are small; don't list them separately.
- The "AI check" in AQS-5640 is a client calling an AI service configured via `system_config`; mention it only if you want to highlight it.
- 31 AQS tickets in the CSV have no commits from me (sub-tasks, QA…) and are not included here.
- Per-ticket details are in `md-aqs/<KEY>.md`.
