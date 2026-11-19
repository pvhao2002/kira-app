# MatchMind — module rules

Scope: `MatchMind/` only ("AI Football Intelligence Platform"). Naming follows `rule-name.md`. The Java package is
`com.matchmind` and the database is `matchmind_db`. The original requirements are in `plan.md`.

- `matchmind-api`: Java 25, Spring Boot 3.5, Spring Security, JPA + JDBC, Flyway, PostgreSQL 17. One package per
  capability: `security`, `provider`, `model`, `external`, `prediction`, `match`, `settlement`, `report`, `prompt`,
  `shared`.
- `matchmind-web`: Angular 22 standalone, zoneless and signals. No component library: native HTML plus the small kit in
  `shared/kit.ts` (tables, dialog, tabs, toasts, confirm), Chart.js via `shared/chart.ts`, PrimeIcons for icons.
  Do not add PrimeNG back: its 20.x+ releases need a paid or approved PrimeTek licence key.
  `core/api.service.ts` is the only HTTP client. `core/models.ts` mirrors the API.
- The contract between them is `docs/API_DOCUMENTATION.md`. Change the API, `core/models.ts`, that file and
  `docs/samples/*.json` together.

## Rules
- **The settlement engine is authoritative and pure.** `SettlementEngine.settle` has no I/O. A rule change bumps
  `SettlementEngine.VERSION` and adds table cases to `SettlementEngineTest`. External AI calculations stay advisory: they
  are stored in `details.aiCalculation` and never decide a result.
- **Settlement results are append-only.** Never `UPDATE` or `DELETE` `prediction_pick_results` except to mark the
  current row superseded in the same transaction that inserts its replacement. Already-settled picks change only via
  admin recalculate/override with a reason.
- **Prediction rows are immutable snapshots** (`@Immutable`). Idempotency is `(provider_id, external_event_id)` plus
  the canonical payload hash. Keep the duplicate (200) / `EVENT_ID_REUSED` (409) behaviour.
- **Integrity lives in the database too.** A new cross-table rule gets a constraint or composite FK, not only Java
  validation.
- Odds, lines and probabilities are `BigDecimal` / `NUMERIC`. Never use `double` for them. Times are UTC
  `TIMESTAMPTZ`/`Instant`.
- Schema changes are new `V<n>__*.sql` files. Never edit an applied migration. Check the highest number first.
- External callbacks bind strictly (unknown field → 400) and every call is audited. Never log or store request bodies
  in the audit, API keys, JWTs or passwords. The shared agent key lives only in `EXTERNAL_API_KEY`; providers and models are created by external calls, never by hand.
- Read endpoints aggregate in SQL with whitelisted sort keys (`Paging.orderBy`) and bound parameters. Never
  concatenate user input into SQL. Never ship a whole dataset to the browser.
- Secrets come from env (`.env` is gitignored; `.env.example` is the shape). No defaults for `JWT_SECRET` or
  `DB_PASSWORD` in compose.
- UI: missing numbers render as `—`, never `0`. Errors show the API `message`. Reports stay full-width and dense.

## Verify (Windows)
- API: `cd MatchMind/matchmind-api && mvn -B verify`. This runs 58 engine unit tests plus Testcontainers ITs and needs
  Docker running. Compile only: `mvn -q compile`.
- Web: use a Node version Angular CLI 22 accepts. 22.20 is rejected; v26.0.0 is used locally via
  `export PATH="/c/Users/<you>/AppData/Roaming/nvm/v26.0.0:$PATH"`. Then run
  `cd MatchMind/matchmind-web && npx ng test --watch=false && npx ng build`.
- E2E (needs the compose stack and an admin account):
  `cd MatchMind/matchmind-web && E2E_BASE_URL=http://localhost:8088 E2E_ADMIN_USER=... E2E_ADMIN_PASSWORD=... npx playwright test`.
- Full stack: `cd MatchMind && docker compose up -d --build`. The web UI is on `http://localhost:8088`.
