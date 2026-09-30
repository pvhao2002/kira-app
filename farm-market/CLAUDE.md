# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in `farm-market`.

## What this is

Farm Market ("Đồi Nắng") is a multi-branch e-commerce platform for a farm business in Vietnam: eggs, animal feed
("Thức ăn chăn nuôi"), livestock/breeding stock ("Con giống"), and a blog. UI copy is **Vietnamese**; currency is VND
(₫). Orders ship from the customer's nearest branch.

**Current state: scaffold only.** There is no backend or frontend code yet. The only substantive artifact is the UI
mockup `designs/Doi Nang Farm Mockups.html` (a bundled, self-contained page; treat it as the source of truth for
screens, routes, roles and copy). `docs/`, `infrastructure/` and `scripts/` are empty.

`farm-market` is a folder inside the `kira-app` monorepo but is planned as its own product. Follow the root
`../CLAUDE.md` and `../AGENTS.md` for general rules, and the conventions of the sibling `../kira-bank` for stack
choices. Add an `AGENTS.override.md` in each new module with its scope and exact verification command.

## Planned layout (mirror `kira-bank`)

- `farm-market-service` — Java 25 Spring Boot 3.5 modular monolith (domain / application / infrastructure / web per
  business capability), JPA, Flyway (`src/main/resources/db/migration`), MySQL 8, OpenAPI, JWT auth.
- `farm-market-ui` — Angular standalone client, strict TypeScript, Signals, lazy routes, responsive.
- `docs/` (architecture, ERD, business rules, API, deployment), `infrastructure/`, `scripts/`.

Create modules only when asked. Compose (`docker-compose.yml`) already references both module folders, so it will not
build until they exist. Host ports are offset from kira-bank: MySQL 3308, API 8081, UI 4201.

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
- Payments: COD, bank transfer (VietQR), e-wallet (MoMo / ZaloPay), card (Visa / Napas).
- Loyalty: 1 point = ₫100 at checkout, points can expire, tiers (Vàng, Kim cương) with perks, points awarded for
  reviews (+50 with photo, +20 text only), vouchers redeemable with points, "Mua lại" (reorder) re-adds a whole order.

## Build / verify commands

Nothing to build yet. Once modules exist, verify only the module you changed, by the method its override specifies:

- Java: `cd farm-market-service` then `./mvnw.cmd compile` (Windows, Java 25). Do not run tests, packaging, Flyway,
  containers or other modules unless explicitly asked.
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
