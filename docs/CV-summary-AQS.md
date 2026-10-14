# Tóm tắt công việc AQS để ghi CV

Nguồn: 89 ticket AQS có commit của bạn (03/2024 → 09/2026), đọc từ `md-aqs/` và git diff.
Hệ thống: AQS / SB11 – nền tảng trading, risk control và kế toán back-office cho sportsbook (Soccer, Cricket, Tennis, Baseball…).
Stack thực tế thấy trong diff: Java/Spring Boot (service `agent`, `aqs-service`, `bookie-system`), MySQL (SQL native, tuning index), Angular (`aqs-report`, `agent-ui`, `sb18-ui`, `sb18-member-ui`), scheduler/crawler (`aqs-scheduler`, `scheduled-service`, `molly-gateway`, `mapping`), WebSocket/SSE, Apache POI, Docker.

## 1. Gợi ý mô tả vai trò (3–4 dòng)

Full-stack Developer (Java Spring Boot + Angular) cho nền tảng trading/risk sportsbook AQS/SB11. Xây dựng và duy trì các báo cáo giám sát bet theo thời gian thực (BBT, BBG, SPP, View 1, Position Report), module kế toán (Journal, Ledger, Fund Control, Chart of Accounts), site SB18 cho Trader/Runner và các job tự động hoá. Tối ưu SQL/hiệu năng, sửa lỗi dữ liệu trên production và làm việc trực tiếp với business/QC qua các vòng QAT → STG → PROD.

## 2. Bullet CV (tiếng Anh, chọn 6–10 dòng)

**Feature lớn**
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
- Made **Follow Bets report near real-time**: SQL moved to `system_config`, bet-status filter, odds conversion, lower refresh load. (AQS-5078)
- Added **Baseball** to the SB11 account PT% flow and **Accounts26** to the Finance Incharge config. (AQS-5213, AQS-5578)

**Hiệu năng / độ ổn định**
- Fixed **PROD timeouts** (HTTP 524) in BBT Last 50 Bets by rewriting SQL (index hints, subquery on pre-aggregated last-bet tables) and adding a `league_id` partition to the scheduler job. (AQS-4940)
- Resolved **browser freezes** on SPP pages by replacing very large `<select>` lists with virtual-scroll `ng-select`. Added infinite scroll and capped the initial query for Miss Account. (AQS-5597, AQS-5271)
- Fixed **Excel/PDF export logging users out** by caching Apache POI `CellStyle` per workbook (fixes style explosion on large data). (AQS-5282)
- Tightened date-range limits and added loading states on heavy reports. (AQS-5357)

**Logic nghiệp vụ / chất lượng dữ liệu**
- Fixed financial and odds calculation bugs: ToRisk/ToWin for negative MY odds, Lay-bet odds sign for new Fair source, HK-odds conversion, odds truncation (not rounding) to 2 decimals, Lay selection display via a configurable resolver. (AQS-5536, AQS-5605, AQS-5478, AQS-5567, AQS-5584, AQS-5572)
- Fixed accounting bugs in Journal/Ledger/Chart of Accounts: ordering of Gain/Loss sub-accounts, zero-amount display, transaction split by timestamp (fixed `performed_date` for batch inserts), Debit/Credit placement for Ledger Currency Translation, wrong UPDATE parameter (parent account name). (AQS-5475, AQS-5685, AQS-5686, AQS-5515, AQS-5512, AQS-4965, AQS-5331, AQS-5511)
- Fixed Transaction Verification, Feed Report grouping, SPP Win/Lose filter counts, BBG stake-size data and Client Balance duplicates. (AQS-5272, AQS-5277, AQS-5692, AQS-5448, AQS-4438)
- Security upgrade: guava 31.1 → 33.1.0 across 4 gateway services. (AQS-4050)

## 3. Số liệu có thể dùng (đã xác minh từ dữ liệu)

- 89 ticket AQS có commit của bạn trong khoảng 03/2024–09/2026 (khoảng 750 commit của bạn trên toàn bộ ticket trong CSV).
- Làm việc trên ít nhất 20 repo, chủ yếu `aqs-report`, `agent`, `agent-ui`, `molly-gateway`, `aqs-scheduler`, `scheduled-service`, `sb18-*`.
- Ticket lớn nhất theo số commit: AQS-5368 (46), AQS-5426 (45), AQS-5232 (41), AQS-5715 (34), AQS-5745 (34), AQS-5559 (35).
- Không có số liệu hiệu năng (ms, %) trong git/Jira, nên đừng ghi con số thời gian cải thiện nếu chưa tự đo.

## 4. Lưu ý trước khi đưa vào CV

- Một số ticket là việc bị revert hoặc làm lại (AQS-5368 hướng 1, phần Set của AQS-5357, AQS-5692 nhánh SQL). Chỉ ghi kết quả cuối.
- Một số ticket chỉ merge theo ticket chính (AQS-4755, AQS-4759, AQS-5723…); đây là việc nhỏ, đừng ghi riêng.
- Phần "AI check" trong AQS-5640 là client gọi dịch vụ AI cấu hình qua `system_config`; chỉ ghi nếu bạn muốn nhấn mạnh phần này.
- Có 31 ticket AQS trong CSV không có commit của bạn (sub-task, QA…); không đưa vào đây.
- Chi tiết từng ticket nằm trong `md-aqs/<KEY>.md`.
