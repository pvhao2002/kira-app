# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in `farm-market`.

## What this is

Farm Market ("Kira Farm") is a multi-branch e-commerce platform for a farm business in Vietnam: eggs, animal feed
("Thức ăn chăn nuôi"), livestock/breeding stock ("Con giống"), and a blog. UI copy is **Vietnamese**; currency is VND
(₫). Orders ship from the customer's nearest branch.

**Current state: UI and backend are built and wired together.** `farm-market-ui` implements every screen of the mockup
`designs/Kira Farm Mockups.html` (source of truth for screens, routes, roles and copy) and talks to
`farm-market-service` through `core/api.ts` (`/api/v1`, dev proxy in `proxy.conf.json`, bearer access token in memory +
HttpOnly `farm_refresh` cookie, `core/auth.interceptor.ts`). `core/mock-data.ts` now only holds static option lists and
view-model types (branch defaults, shipping/payment options). `farm-market-service` implements identity/JWT, branches,
catalog, inventory, promotions, orders (idempotent checkout, state machine), loyalty, addresses/wishlist/reviews and admin
dashboard/customers/users under `/api/v1`, with Flyway V1-V7. Verified manually against MySQL 8: Flyway, startup,
login, catalog, checkout, status changes, loyalty points, admin dashboard and theme save, plus `farm-market-service/smoke.sh`.
`docker compose build` was not verified (Docker Hub login was rejected on the dev machine). `docs/`, `infrastructure/`
and `scripts/` are empty.

Staff/manager/admin log in with a real TOTP second factor (`/auth/login` returns `{otpRequired, challengeToken, enrolled}`, then `/auth/otp/enroll` + `/auth/otp/verify`; secrets AES-GCM encrypted with `TOTP_ENCRYPTION_KEY`; dev seed secret in README; helper `farm-market-service/totp.js`; Flyway V5). Flyway V6 adds two query-driven indexes (`ix_orders_dashboard`, `ix_users_role_created`; EXPLAIN evidence in `IndexExplainIT`).

Back-office accounts: `BootstrapAdminRunner` (`@Order(0)`, env `APP_BOOTSTRAP_ADMIN_EMAIL`/`APP_BOOTSTRAP_ADMIN_PASSWORD` >= 12 chars/`APP_BOOTSTRAP_ADMIN_NAME`, `app.bootstrap-admin.*`) creates the first admin only when no admin exists and never overwrites a user. Admin then uses `POST /admin/users` (staff/manager/admin with temporary password + branches; the user enrolls TOTP at first login) and `PUT /admin/users/{id}/role` (422 `CANNOT_CHANGE_OWN_ROLE`, 422 `LAST_ADMIN`, drops branches when becoming admin, revokes the user's refresh tokens). UI: `/admin/users`.

Password reset (Flyway V7 `password_reset_tokens`): `PasswordResetService` + `PasswordResetNotifier` (`LoggingPasswordResetNotifier` only in profile `dev`, `NoopPasswordResetNotifier` otherwise: never logs the token, no SMTP yet). `POST /auth/password/forgot` always 202, 5/15min per email via `LoginRateLimiter.checkForgot` (per instance); token 30 min (`app.password-reset.ttl`), single use via conditional UPDATE, SHA-256 at rest, newest token only; link `app.public-url` + `/reset-password#token=`. `POST /auth/password/reset` revokes all refresh tokens; `POST /auth/password/change` revokes the other sessions (family of the `farm_refresh` cookie is kept). `RefreshTokenRepository.revokeAllByUser` / `revokeOthersByUser` do the bulk revoke.

Media (`media` package): `MediaService` stores images on local disk (`app.media.dir` = `APP_UPLOAD_DIR`, `max-bytes` 5MB, `spring.servlet.multipart` 5MB/6MB), `ImageSniffer` decides JPEG/PNG/WebP from magic bytes only (no SVG; client name/Content-Type ignored), names are `<uuid>.<ext>`. `POST /admin/media/products` (MANAGER/ADMIN), `POST /media/reviews` (user with a DELIVERED order), both rate limited via `LoginRateLimiter.checkUpload` (20/10min per user, per instance); `GET /api/v1/files/{name}` is public and streamed by `MediaController` (name regex `MediaService.NAME`), cached `public, max-age=31536000, immutable` by `PublicCacheFilter` (deliberate extension of the filter). `ReviewRequest.photoUrl` / `ProductRequest.imageUrl` accept only system URLs (`MediaUrl.REGEX_OR_EMPTY`); a review photo must also exist on disk. Local disk means ONE instance (ponytail: move to object storage before scaling out); orphaned files are not swept.

Known gaps: no real wallet/card gateway (EWALLET/CARD are recorded and confirmed manually by staff; BANK_TRANSFER shows a VietQR image from `app.payment.bank` and staff confirm via `POST /admin/orders/{code}/payment`, which writes an internal order note, no migration), no OTP backup codes/QR image, no UI tests (backend: 43 pure unit tests via `./mvnw.cmd test`, no DB; 44 integration tests `*IT` via `./mvnw.cmd verify`, see Build / verify). Loyalty rewards are configuration (`app.loyalty.rewards` in `application.yml`, `LoyaltyProperties`, validated at startup): business decisions, edit config not code. Cancelling an
order refunds spent points (`ORDER_CANCEL_REFUND`), re-opens a used voucher and releases the promotion redemption in the
same transaction (`OrderWorkflow`). `PUT /auth/me` edits name/phone/birth date/gender. Product writes are manager/admin only.

Local run: `docker compose up -d mysql`, then in `farm-market-service` set `DB_URL=jdbc:mysql://localhost:3308/farm_market?...`,
`DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `APP_SEED_DEVELOPMENT_USERS=true`, `SERVER_PORT=8081` and run
`./mvnw.cmd spring-boot:run`; then `npm start` in `farm-market-ui` (needs Node >= 22.22.3). Dev users share the password
`KiraFarm@123`. Do not use `MYSQL` column names that are reserved words (e.g. `last_value`).

Angular 22's CLI needs Node >= 22.22.3 / 24.15 / 26. If the default Node is older, run the CLI with a newer one. If
`npm install` fails with `edgesOut`, retry with `--legacy-peer-deps`.

`farm-market` is a folder inside the `kira-app` monorepo but is planned as its own product. Follow the root
`../CLAUDE.md` and `../AGENTS.md` for general rules, and the conventions of the sibling `../kira-bank` for stack
choices. Add an `AGENTS.override.md` in each new module with its scope and exact verification command.

## Planned layout (mirror `kira-bank`)

- `farm-market-service` — Java 25 Spring Boot 3.5 modular monolith (domain / application / infrastructure / web per
  business capability), JPA, Flyway (`src/main/resources/db/migration`), MySQL 8, OpenAPI, JWT auth.
- `farm-market-ui` — Angular standalone client, strict TypeScript, Signals, lazy routes, responsive.
- `docs/` (architecture, ERD, business rules, API, deployment), `infrastructure/`, `scripts/`.

Both modules exist. Create further modules only when asked. Host ports are offset from kira-bank: MySQL 3308, API 8081, UI 4201.

## Product model (from the mockup)

- Routes (customer): `/products`, `/products/:slug`, `/checkout`, `/login`, `/account`, `/account/orders`,
  `/account/addresses`, `/account/wishlist`, `/account/rewards`, `/account/reviews`.
- Routes (admin): `/admin`, `/admin/orders`, `/admin/products`, `/admin/inventory`, `/admin/customers`,
  `/admin/promotions`, `/admin/branches`, `/admin/branches/theme`.
- Roles: Customer, Staff, Admin. Customers hitting `/admin` are redirected home. Staff see only data for branches they
  are assigned to. Admin sees all branches and can configure branch theme colors and staff permissions. An
  unauthenticated user sent to login from checkout returns to `/checkout`, not `/account`.
- Multi-branch: products, inventory and orders are scoped to a branch; every order records its fulfilling branch; each
  saved address resolves to a nearest branch. Wishlist availability follows branch stock.
- Payments: COD, bank transfer (VietQR image, no gateway), e-wallet (MoMo / ZaloPay) and card (Visa / Napas) recorded only and handled manually by staff.
- Loyalty: 1 point = ₫100 at checkout, points can expire, tiers (Vàng, Kim cương) with perks, points awarded for
  reviews (+50 with photo, +20 text only), vouchers redeemable with points, "Mua lại" (reorder) re-adds a whole order.

## Build / verify commands

Nothing to build yet. Once modules exist, verify only the module you changed, by the method its override specifies:

- Java: `cd farm-market-service` then `./mvnw.cmd compile` (Windows, Java 25). Do not run tests, packaging, Flyway,
  containers or other modules unless explicitly asked.
- Integration tests (`*IT`, Testcontainers MySQL `mysql:8.0`, needs a running Docker, nothing is pulled if the image is already local): `cd farm-market-service` then `$env:TESTCONTAINERS_RYUK_DISABLED='true'; .\mvnw.cmd verify` (PowerShell; failsafe also sets it). `.\mvnw.cmd test` stays DB-free and skips `*IT`. ITs share ONE container and one Spring context (`it/IntegrationTestBase`), seed users via the dev seeder, and isolate themselves by creating their own customers/products/staff.
- `farm-market-service` guard rails inside `verify`: `OpenApiContractIT` (the `/v3/api-docs` document must equal `src/test/resources/openapi-baseline.json`; regenerate ONLY for a conscious contract change with env `OPENAPI_REGEN=true`), `QueryCountIT` (statements per request via the test-only `SqlCounter` DataSource proxy; fails when a list endpoint grows with page size or exceeds its bound; `QC_BASELINE=1` prints the table and skips the bounds), `IndexExplainIT` (EXPLAIN on 150k scratch orders), `PublicCacheHeadersIT`, `OperationalConfigIT`.
- Runtime knobs (all env-overridable in `application.yml`): `DB_POOL_MAX` (20), `DB_POOL_MIN_IDLE` (5), `DB_CONNECTION_TIMEOUT_MS` (5000), `DB_MAX_LIFETIME_MS` (1740000, keep below MySQL `wait_timeout`), `DB_LEAK_DETECTION_MS` (0 = off), `HIBERNATE_BATCH_SIZE` (50), `HIBERNATE_FETCH_BATCH_SIZE` (32), `SHUTDOWN_TIMEOUT` (30s), `HTTP_COMPRESSION`, `TOMCAT_MAX_CONNECTIONS`, `TOMCAT_ACCEPT_COUNT`, `API_DOCS_ENABLED`; `app.http-cache.*` (`enabled`, `static-max-age-seconds` 60, `product-max-age-seconds` 10). Request threads are virtual (`spring.threads.virtual.enabled`), so the Hikari pool, not a thread count, is the concurrency limit. Probes: `/actuator/health/liveness` and `/readiness` are public and detail-free; every other `/actuator/**` (metrics, info) is ADMIN-only.
- UI: do not run `npm run build`, lint, tests or a dev server unless requested; a build is not proof of correct UI.
- `docker compose up -d` only when local infrastructure is needed for a manual runtime check.
- API or contract changes: update backend DTO/controller, frontend models/callers and docs together, and inspect both
  sides of the contract. Keep `/api/v1` stable unless a versioned change is requested.

## Cross-cutting rules

- Money: `BigDecimal` with explicit rounding (VND has no minor unit, but keep the rule), never floating point. Orders,
  payments, vouchers and loyalty points are integrity-sensitive: keep them auditable, append-only where ledger-like,
  idempotent on retry (payment callbacks, point awards), and enforce ownership checks server-side.
- Stock decrements must be atomic per branch to avoid overselling.
- Schema changes are additive Flyway migrations; never edit an applied one. Backfills must be deterministic.
- Never log tokens, passwords, secrets, JWTs, payment payloads or customer addresses/phones. Return stable domain
  errors (via a global exception handler with trace IDs), never SQL or stack traces.
- Secrets live in environment variables / `.env`, never in code. Use `.env.example` as the shape reference.
- Dev seed users only when `APP_SEED_DEVELOPMENT_USERS=true` and never in production.
- Keep UI copy in Vietnamese unless told otherwise; follow the mockup's design tokens (dark green `#2e5233`, warm
  yellow `#f2d98a`) and per-branch theme colors.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`), one concern per commit.
