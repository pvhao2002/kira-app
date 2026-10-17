# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`kira-bank` is a nested, independently git-tracked repo inside the larger `kira_app` monorepo (the parent `CLAUDE.md`
also applies). The product is "Kira Life": credit cards/statements/payments, investment accounts + AI-imported
transaction history, health, travel, lodging, password vault, karaoke/job tracker, tutoring, Telegram links. Product
copy and docs are mostly Vietnamese; i18n keys exist in en + vi.

## Instruction layering

`AGENTS.override.md` at this level governs cross-module work (docs, Compose, scripts). Each app dir has its own
`AGENTS.override.md` (service, ui, desktop, desktop-v2) with scope, change rules and the verification command — read it
before touching that module; it wins over this file. `kira-life-mobile` has no override (see its `README.md`,
`SCREEN-MAP.md`, `VISUAL-QA.md`).

Default rule: verify only the module you changed, by the method its override gives. Do not run tests, packaging, Docker
or other modules unless asked. A compile/build is not proof of UI behavior.

## Modules and commands

| Module | Stack | Commands |
| --- | --- | --- |
| `kira-bank-service` | Java 25, Spring Boot 3.5, JPA, Flyway, MySQL 8, JWT | `./mvnw spring-boot:run`; verify with `./mvnw.cmd compile` (Windows) |
| `kira-bank-ui` | Angular 22 standalone, Signals, strict TS | `npm start` (port 4201, proxies `/api` via `proxy.conf.js`); `npm test` = `ng test --watch=false` (vitest) |
| `kira-life-mobile` | Expo SDK 57 / React Native, Expo Router | `npm start`, `npm run web`; **no test runner** |
| `kira-bank-desktop-v2` | Go 1.27 + Fyne v2 native client | `go build ./... && go vet ./... && go test ./...` (needs CGO) |
| `kira-bank-desktop` | Tauri v2 webview shell over deployed UI (superseded by v2, kept unchanged) | `npm test`, then `cargo check` in `src-tauri` |

Local specifics (macOS):
- `./mvnw` is not executable and default `mvn` picks an old JDK. Use `JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -q test -Dtest=<Class>`.
- Single backend test: `-Dtest=ClassName` or `-Dtest=ClassName#method`. `*IT` classes use Testcontainers MySQL and only run when named explicitly with `-Dtest=`.
- Single UI test: `ng test --watch=false --include=<path/to/file.spec.ts>`.
- Do not point the service at the MySQL on host port 3310 (another project's). Compose MySQL is on host port 3307.
- `docker compose up --build` (root `docker-compose.yml`; `docker-compose.hub.yml` is the registry-image variant) only when runtime verification truly needs it. Config shape is `.env.example`; real `.env` is never committed.
- Dev seed users exist only when `app.seed-development-users=true` (see `README.md`).

## Architecture

**Backend** (`com.kira.bank.<capability>`): one package per business capability — `creditcard`, `investment`,
`identity`, `attachment`, `ai`, `dashboard`, `health`, `travel`, `lodging`, `passwordvault`, `jobtracker`, `karaoke`,
`tutoring`, `telegram`, `notification`, `analytics`, `publiccatalog`, `storage` — each split into
`domain / application / infrastructure / web`. `shared` holds cross-cutting domain/infrastructure/web pieces
(including `GlobalExceptionHandler`: all API errors go through it with stable codes + trace IDs).
Controllers thin, `@Transactional` in application services, entities free of web concerns.

Cross-cutting backend flows that span several packages:
- **AI document pipeline**: `attachment` (upload to Cloudflare R2 via `R2StorageService`) → scheduled AI jobs
  (`InvestmentReceiptAiScheduler`, `InvestmentAiJobService`, manual-run service) → `ai` provider clients
  (`AiDocumentClient` behind interfaces, Workers AI failover) → draft returned to the user. Results are always drafts;
  the user reviews and confirms before any financial data is persisted. Provider credentials (Cloudflare account, Workers
  AI token, R2 keys) are stored encrypted in the DB (`AiCredentialCipher`, master key `AI_CREDENTIAL_ENCRYPTION_KEY`) and
  managed at runtime via `/admin/cloudflare-accounts`, not env vars. Only cron/timeout/retry stay as config.
- **Domain separation**: credit-card and investment data are independent (no cross-domain FKs). Investment history is
  not balance/capital and creates no ledger entries; the business dashboard aggregates credit cards only.
- **Money integrity**: `BigDecimal` with explicit rounding; ledger append-only; payment/settlement idempotent; optimistic
  `version` on updates/deletes; ownership checks server-side. See `docs/business-rules/financial-integrity.md`.

**Schema**: Flyway only, `kira-bank-service/src/main/resources/db/migration/V<n>__*.sql`. Add a new version; never edit
an applied one. Check `ls | sort -V | tail` for the next number — duplicate version numbers make Flyway reject startup
(a duplicate `V33` has happened before).

**Web UI** (`kira-bank-ui/src/app`): `core/` (auth, guards, interceptors, i18n, layout, routing, services),
`features/<page>/` (one per screen, lazy routes via `app.routes.ts`), `shared/` (reusable widgets, API `models`).
Repeated CRUD pages use `resource.page` + `resource-definitions.ts` — extend these rather than cloning pages. Refresh
token is an HttpOnly cookie; access token is handled in `core/auth`. Design tokens/rules: `DESIGN.md`, `design-system/`.

**Mobile** (`kira-life-mobile`): Expo Router in `app/(tabs)` (credit card, investment, travel, health, profile); most
logic lives flat in `src/` as `<feature>.tsx` screens plus `<feature>Api.ts` clients. `EXPO_PUBLIC_API_URL` points at the
service. Has uncommitted work from other efforts — only touch what the task needs.

**Desktop v2** (`kira-bank-desktop-v2`): reimplements every UI screen natively. Auth uses
`POST /api/v1/auth/mobile/{login,refresh,logout}` (refresh token in JSON body, kept in OS keyring). A new page is a
feature package under `internal/ui/pages/<feature>` exporting `Pages(env)`, registered with one import + one append in
`internal/ui/pages/registry.go`; add strings to both `internal/i18n/en.json` and `vi.json`
(`registry_test.go` enforces unique IDs and existing keys). Money is `shopspring/decimal`; network off the UI goroutine.

**API contract**: everything is under `/api/v1`. An API change must update, in the same task: backend DTO/controller,
`kira-bank-ui` models/callers, and — where they consume the endpoint — `kira-life-mobile` and `kira-bank-desktop-v2`,
plus the matching file in `docs/api/`. Desktop modules must not change the UI, service or contract.

## Docs

`docs/` has `api/` (per-domain contract notes), `architecture/`, `business-rules/`, `database/erd.md`,
`deployment/production.md`. `scripts/sync-vietqr-banks.ps1` is dry-run by default and idempotent with `-Apply`.
