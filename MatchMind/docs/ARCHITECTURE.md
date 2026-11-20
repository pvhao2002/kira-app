# MatchMind architecture

MatchMind ("AI Football Intelligence Platform") stores football predictions produced by external AI systems, settles
them against real results with a deterministic engine, and reports how each AI model performs.

```
 AI agents ────X-Api-Key──▶ ┌────────────────────────┐
  (callbacks)                │      matchmind-api      │──JDBC──▶ PostgreSQL 17 (matchmind_db)
                             │ Spring Boot 3.5, Java 25│          Flyway-owned schema
 Browser ──▶ matchmind-web ──▶│  /api/v1/**  (JWT)     │
            (nginx + Angular) └────────────────────────┘
```

| Part | Tech | Responsibility |
|---|---|---|
| `matchmind-api` | Java 25, Spring Boot 3.5, Spring Security, Spring Data JPA, JDBC, Flyway, Actuator, springdoc | Auth, callback ingestion, settlement, reporting, admin CRUD |
| `matchmind-web` | Angular 22 (standalone, zoneless, signals), native HTML + in-house kit, Chart.js, PrimeIcons | Dashboard UI |
| PostgreSQL 17 | UUID, TIMESTAMPTZ, JSONB, NUMERIC | Source of truth, with integrity enforced by constraints |
| nginx (in the web image) | | Serves the SPA and proxies `/api/` to the API (same origin, so the UI needs no CORS; only `/api/v1/external/**` answers other origins, for the MatchMind artifact) |

## Backend layout (`com.matchmind`)

Packages are business capabilities. Each package holds its entities, repositories, services and controllers.

| Package | Content |
|---|---|
| `security` | Users, JWT issue/verify (`tv` claim = `token_version`), `JwtAuthenticationFilter`, `ApiKeyAuthenticationFilter`, login rate limiter, admin bootstrap, `SecurityConfig` |
| `provider` | Providers, created on first use from the `X-Provider` header (read-only otherwise) |
| `model` | AI model registry per provider |
| `external` | The three callback endpoints, strict JSON binding, audit (`external_api_requests`, `REQUIRES_NEW` so a failed call is still logged), API log read API |
| `prediction` | Ingestion (validation, idempotency, match upsert) and read models |
| `match` | Match queries and result application (stale-result guard, history, automatic settlement) |
| `settlement` | `SettlementEngine` (pure function, version `settle-v1`) and `SettlementService` (append-only results, recalculate, override) |
| `report` | Dashboard and the five reports via SQL aggregation, CSV/XLSX export |
| `prompt` | Prompt templates with optimistic versioning |
| `shared` | Error model and handler, paging, filters, SQL helpers, trace id, client IP resolution, export writer |

### Write path: prediction callback
1. `ApiKeyAuthenticationFilter` compares the SHA-256 of `X-Api-Key` with the shared `EXTERNAL_API_KEY` in constant
   time, then reads `X-Provider` and finds or creates that provider. Failures are audited as `REJECTED`
   (`401 INVALID_API_KEY`, `400 PROVIDER_REQUIRED` / `INVALID_PROVIDER`).
2. `ExternalController` reads the raw body (≤ 1 MB) and binds it strictly: unknown fields are rejected and bean
   validation runs.
3. `PredictionIngestionService.ingest`, in one transaction:
   - Finds the model (`X-Model-Name`, else `model` in the body) or creates it with `INSERT … ON CONFLICT`.
   - Runs the cross-field rules (market/price/line shape, LIVE requirements, pick ↔ odds references).
   - Upserts the match with `INSERT … ON CONFLICT` and then locks it.
   - Inserts the prediction, odds, stats, simulation, picks and correct scores.
4. Idempotency uses `UNIQUE (provider_id, external_event_id)` plus a SHA-256 of the canonical JSON:
   - Same event and same hash → `200 duplicate`.
   - Different hash → `409 EVENT_ID_REUSED`.
   - A concurrent insert race is caught as a constraint violation and resolved to the stored row.
5. The audit row is written in its own transaction with the outcome and a short processing summary. Bodies, keys and
   headers are never logged.

Database constraints back every rule that matters, so a bug in application code cannot store inconsistent data:
- Composite FKs pin match, model and odds to the same provider and prediction.
- Checks enforce prices per market, quarter-line multiples, LIVE snapshots, score pairs and the remaining-match capture
  score.

### Settlement
- `SettlementEngine` is a pure function of (market, pick, line, basis, match status, final score/corners, capture
  score/corners) → (result, reason, details). It covers:
  - Asian quarter lines (split into two half-stakes).
  - `REMAINING_MATCH`, which uses final minus at-capture values.
  - VOID for cancelled matches and PENDING for unfinished ones.
  - Corner markets.
  It is covered by 58 table-driven unit tests.
- Results are **append-only**:
  - A partial unique index allows one `is_current` row per pick.
  - Recalculation or override supersedes the current row. Nothing is updated in place or deleted.
- Settlement runs automatically when a result arrives with `FINISHED` or `CANCELLED`. It also runs on the external
  settle request and on admin request. The match row is locked, so concurrent result and settle calls cannot
  double-settle.
- Already-settled picks are never silently changed:
  - A different fresh outcome is reported as `NEEDS_REVIEW`.
  - Changes happen only through an admin recalculation or override, with a reason.
- External AI calculations are advisory. They are stored with the result details and compared, but never decide the
  result.

### Read path
Lists and reports use `NamedParameterJdbcTemplate` with whitelisted sort columns and bound parameters. Aggregation
happens in SQL:
- `count(*) FILTER (…)` over the current settlement row.
- `LATERAL` joins for "latest prediction" and "top pick".

The browser receives only one page or one aggregate at a time. The history export runs the same query in memory and is capped at
50 000 rows.

### Security
- Stateless JWT (HS256, secret ≥ 32 bytes from `JWT_SECRET`, default TTL 8 h). Revocation uses `token_version`.
- BCrypt (cost 12). Login uses dummy-hash timing equalisation for unknown users. The rate limiter counts attempts per
  client IP and failures per username.
- Client IPs come from `X-Forwarded-For` only when the direct peer is in `TRUSTED_PROXIES`.
- Roles: `VIEWER` is read-only; `ADMIN` can write. The shared agent key only reaches `/external/**`.
- Errors are a fixed JSON shape with a code and `traceId`. There are never stack traces or SQL.
- Secrets come only from environment variables. `.env` is gitignored.

## Frontend layout (`matchmind-web/src/app`)

| Path | Content |
|---|---|
| `core/` | `models.ts` (typed API contracts), `api.service.ts` (the only HTTP client), `auth.service.ts` (session in `sessionStorage`, expiry timer), `http.ts` (bearer + 401 interceptor, error toasts, guards) |
| `shared/` | Formatting helpers, `mm-score` scoreboard chip, `mm-result` tag, `mm-json` viewer, `mm-state` (loading/error/empty), `mm-filter-bar`; `kit.ts` (sortable/resizable table headers, paginator, row expansion, native `<dialog>`, confirm, tabs, toasts); `chart.ts` (Chart.js wrapper, loaded only by Dashboard and Reports) |
| `layout/shell.ts` | Collapsible navy sidebar, top bar with page title and sign out |
| `pages/` | Login, Dashboard, Matches, Match detail, Predictions, Prediction detail, AI Models, Model detail, Reports, Prompt Notes, API Logs, Settings |

- Routes are lazy (`loadComponent`). Route params bind to `input()`.
- Large lists (matches, predictions, prediction history, API logs, comparison, Monte Carlo) page and sort on the server;
  small aggregated tables (models, market performance) sort in the browser.
- There is no UI component library. PrimeNG was dropped because its current releases require a PrimeTek licence key;
  native elements (`<dialog>`, `<input type="date">`, `<select>`, `<details>`) cover what it provided.
- Reports keep the active tab in `?tab=`. Prediction-history column visibility is remembered per browser.
- The JWT lives in `sessionStorage`: it is per tab and never a cookie, so there is no CSRF surface.
- A `401` from any API call ends the session and redirects to `/login?expired=1`.

## Deployment

`MatchMind/docker-compose.yml` runs three services with health checks:

| Service | Image | Health check |
|---|---|---|
| `db` | `postgres:17-alpine` | `pg_isready`. Named volume |
| `api` | `matchmind-api:local` (patched Corretto 25, non-root) | `/actuator/health` |
| `web` | `matchmind-web:local` (nginx) | `/healthz`. Security headers + CSP; proxies `/api/` |

Startup order is gated on `service_healthy`. Only the web port is published on all interfaces. DB and API ports bind to
`127.0.0.1`.
