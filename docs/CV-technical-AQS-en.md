# Technical Summary – AQS Work

Source: git diffs of the 89 AQS tickets with my commits (03/2024 → 09/2026). This file is grouped by skill/technique, not by business domain. Ticket keys point to `md-aqs/<KEY>.md` for details.

## 1. Tech stack (seen directly in the diffs)

| Layer | Technologies |
|---|---|
| Backend | Java, Spring Boot, Spring MVC REST, Spring `@Scheduled`, Spring Security (`@PreAuthorize`), `NamedParameterJdbcTemplate`/`MapSqlParameterSource`, Lombok (`@RequiredArgsConstructor`), Guava Cache, Apache POI, Jackson/Gson, RestTemplate, `SseEmitter` |
| Database | MySQL: native SQL, CTEs, window functions (`ROW_NUMBER() OVER PARTITION BY`), `EXISTS`, `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, `FORCE INDEX`, `TIMESTAMPDIFF`/`DATE_SUB`, DDL migration scripts |
| Frontend | Angular (from `*ngFor`-era versions up to Angular 21 with signals, `@if`/`@for`, standalone pipes), RxJS (`forkJoin`, `switchMap`, `interval`, `Subject`, `EMPTY`), ngx-bootstrap (modal, popover, tooltip), ng-select (virtual scroll), Angular CDK virtual scroll, ngx-perfect-scrollbar, ngx-infinite-scroll, i18n JSON, SCSS |
| Realtime | WebSocket service (heartbeat), Server-Sent Events (`EventSource` on the client, `SseEmitter` on the server), `interval` polling |
| Integrations | HTTP/JSON crawlers (LiveScore, Sofascore), blockchain explorer APIs (ERC20/TRC20), configurable AI service client, provider callbacks (Merito) |
| Other | Maven `pom.xml`, Dockerfile, SonarQube (issue fixes), unit tests (Spring controller tests, Angular `.spec.ts`) |

## 2. Technical skills by area

### 2.1 SQL optimization and query performance
- Rewrote slow queries that caused HTTP 524 on PROD: changed index hints (`FORCE INDEX (PRIMARY)`, `idx_settlement_actual_date`), joined pre-aggregated tables instead of scanning the large bet table, pushed filters into subqueries. (AQS-4940)
- Used `ROW_NUMBER() OVER (PARTITION BY ...)` for top-N per group (top 50 bets per league, first 200 accounts per provider). (AQS-4940, AQS-5271)
- Replaced `LEFT JOIN` + counting with `EXISTS(...) OR EXISTS(...)` chains and CTEs for "has data" checks. Faster and correct per hierarchy level. (AQS-5295, AQS-5344)
- Used CTE + `LEFT JOIN` to keep rows without child data, and running balances up to a cut-off date. (AQS-5706)
- Added `LIMIT/OFFSET` pagination with a `COUNT` sharing the same base SQL. (AQS-5357, AQS-5271)
- Added indexes and new columns through migration scripts. (AQS-5638, AQS-5559)

### 2.2 Frontend performance
- Fixed browser freezes caused by dropdowns with thousands of items: replaced `<select>` with virtual-scroll `ng-select`. (AQS-5597)
- Infinite scroll with duplicate-request guards (`loadingMap`, `isLoading`) and per-group offsets. (AQS-5271, AQS-5340)
- Tried CDK virtual scroll for large tables (later reverted on request). (AQS-5357)
- Reduced periodic refresh load (15 s → 60 s) and unsubscribed in `ngOnDestroy` to prevent leaks. (AQS-5078)
- Controlled sequential/parallel API calls with `forkJoin` + `switchMap` instead of nested callbacks. (AQS-5368)

### 2.3 Backend memory and resource handling
- Fixed Excel/PDF export logging users out: Apache POI created a new `CellStyle` per cell and exceeded the style limit. Cached styles by `StyleKey`, scoped per workbook with a Guava `Cache` (`expireAfterAccess`). (AQS-5282)
- Removed unnecessary `@Transactional` from read-only methods. (AQS-5368)

### 2.4 Scheduled jobs and background processing
- Wrote `@Scheduled` jobs on 10 s / 30 s / 60 s cycles with `initialDelay`, processing in batches (claiming up to 100 pending rows from a queue table). (AQS-5640, AQS-5573, AQS-5230)
- Designed fault-tolerant jobs: 15 s connect/read timeouts, per-item error catching and logging so one failure does not break the whole run. (AQS-5308)
- Safely removed an obsolete job together with its service and SQL constants. (AQS-5502)
- Fixed seconds drift in batch inserts by using one fixed timestamp for the whole batch instead of `current_time`. (AQS-5475)

### 2.5 Config-driven design
- Moved SQL, thresholds and rules into `system_config` or dedicated config tables so behavior changes need no deploy: report SQL, stake threshold, role lists, time bands, market types, AI settings. (AQS-5078, AQS-5573, AQS-5578, AQS-5739, AQS-5745, AQS-5640)
- Balance parser driven by JSON rules (`parse_rule`: type, decimals, path, field, match). New networks/tokens only need new data. (AQS-5308)
- Selection-display resolver with strategies and rules per sport/page/market, `{{token}}` templates, and a GET/PUT config API. (AQS-5584)
- Config cache with TTL (2 min, 10 min) plus a cache-bypassing read when fresh data is required. (AQS-5078, AQS-5573, AQS-5612)
- Config validation with clear errors; UI locks actions when config is invalid. (AQS-5715)

### 2.6 Realtime and online presence
- Heartbeat service: stores last heartbeat per user in a `ConcurrentMap`, a 30 s job marks users offline. Avoids race conditions with `cacheMap.remove(key, lastHeartbeat)`. (AQS-5426, AQS-5643)
- Pushes online-user counts via SSE: server broadcasts with `SseEmitter`, client uses `EventSource` with a parser, auto-reconnect and auth token, exposed as an Angular signal. (AQS-5643)
- Conditional polling (only while the user is online); 10 s alert-bell polling, refreshed immediately via `Subject` on events. (AQS-5643, AQS-5640, AQS-5757)

### 2.7 Crawlers and external integrations
- Live-score crawler for two sources (LiveScore, Sofascore): JSON-to-model mapping, upsert per set/inning, body logging only when content changes, manual trigger endpoints for testing. Sofascore's required header is derived from a SHA-256 of the timestamp. (AQS-5230, AQS-5232)
- Provider callback handling with automatic account assignment based on a currency-converted threshold. (AQS-5573)
- AI service client (enable flag, URL, API key and prompt all configured in DB) used as an extra verification step. (AQS-5640)

### 2.8 Algorithms and data matching
- Detected reversed team mappings: split names with regex, normalized (`reduceNoise`), matched with Jaro-Winkler (cutoff 0.92), stored status `CHECKED_OK` / `CONFIRMED_OPPOSITE` / `FAILED`. (AQS-5640)
- Grouping and de-duplication with Java Streams (`groupingBy`, `toMap` with merge function, `distinct`, multi-level comparators with `nullsLast`). (AQS-5277, AQS-5690, AQS-5686)
- Traversal of an account hierarchy tree (parent_id), path-based expansion with stub nodes when missing. (AQS-5612)

### 2.9 Numeric and currency calculations
- Odds conversion between formats (DEC/HK/MY), negative odds, Lay/Back handling. (AQS-4759, AQS-5478, AQS-5536, AQS-5605)
- Truncation instead of rounding (`Math.trunc`) via a reusable standalone pipe. (AQS-5567, AQS-5584)
- Division-by-zero guards (Infinity), correct handling of falsy `0` in templates (`!== null` instead of truthy checks). (AQS-5432, AQS-4203, AQS-5515)
- Currency conversion via exchange-rate tables in SQL. (AQS-5482, AQS-5573)

### 2.10 API design and security
- Designed new REST endpoints with per-feature authorization via `@PreAuthorize(hasAuthority(...))`. (AQS-5612, AQS-5638, AQS-5640, AQS-5559, AQS-5739)
- Mapped `IllegalArgumentException` → HTTP 400; caught `DuplicateKeyException` to return business-friendly messages. (AQS-5739, AQS-5308)
- Server-side input validation (valid bands, market allowlists, conflicting filter combinations). (AQS-5715, AQS-5739)
- Audit logging within the same transaction (`@Transactional`, written only when the value actually changes). (AQS-5638, AQS-5559)
- Upgraded a vulnerable library (guava 31.1 → 33.1.0) across 4 services. (AQS-4050)

### 2.11 Frontend architecture
- Reused one component for several report variants through a `:source` route param instead of duplicating code (after dropping a separate-component approach). (AQS-4480, AQS-5368, AQS-5559)
- Extracted shared helpers/pipes/services: `TruncateDecimalPipe`, `FormatValuePipe` with `zeroPlaceholder`, layout-source helper, cached config service. (AQS-5567, AQS-5685, AQS-5559, AQS-5715)
- Popover-based multi-select with Select All and a "+N" label. (AQS-5745)
- Fixed Angular forms bugs: missing `name` on `ngModel` controls, mutating the `form.value` snapshot instead of calling `FormControl.setValue`. (AQS-5382, AQS-5511)
- Rendered popovers into `body` (`container: 'body'`) to avoid clipping by scroll containers; synced row heights between two split tables. (AQS-5284, AQS-4383)
- Numeric input with normalization and step validation (.00/.25/.50/.75), with spec tests. (AQS-5643)

### 2.12 Maintenance and code quality
- Migrated `@Autowired` field injection to constructor injection across 63 files and fixed Sonar warnings. (AQS-5271)
- Removed dead code and unused functions/constants; merged duplicated logic into shared functions (`appendCommonBetFilters`, `resolveCurrentSourceFilter`). (AQS-5740, AQS-5559)
- Managed controlled revert/reapply when an approach did not work out (AQS-5368, AQS-5357, AQS-5692); cherry-picked across develop/staging/prod branches. (AQS-5597)

## 3. Technical CV bullets (pick 5–8)

- Diagnosed and fixed production query timeouts (HTTP 524) by rewriting MySQL queries with index hints, window functions and pre-aggregated tables.
- Fixed an Excel export crash that logged users out by caching Apache POI cell styles per workbook (Guava cache).
- Built real-time presence tracking using a WebSocket heartbeat service and Server-Sent Events, with a race-safe offline sweep (`ConcurrentMap.remove(key, value)`).
- Designed config-driven features (SQL, thresholds, rules, JSON parse rules stored in DB with TTL cache), so behavior changes need no redeploy.
- Wrote scheduled crawlers and batch jobs (10–60 s cycles, queue claiming, per-item fault isolation, 15 s timeouts) for live scores, wallet balances and data validation.
- Implemented fuzzy team-name matching (Jaro-Winkler, regex normalization) with an optional AI verification step to detect reversed event mappings.
- Fixed browser freezes on large Angular pages using virtual scroll (ng-select, CDK) and infinite scroll with request de-duplication.
- Built secured REST APIs (Spring Security authorities, server-side validation, transactional audit logs) and reusable Angular components, pipes and services across 4 Angular apps.
