# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This is a monorepo of independent, separately-versioned services and apps for the "Kira" sports-data / crawling /
finance platform. There is no shared build system — each module builds and is verified on its own.

Backend (Java 21, Spring Boot, own `pom.xml` + Maven wrapper each):
- `kira-gateway` — authenticated HTTP entry point (security, users, finance/dashboard APIs, travel checklists, crawl
  callbacks, orchestrates producer/data-manager/crawl/Gemini calls)
- `kira-producer` — schedules and publishes crawl/prediction/backfill/settlement jobs to RabbitMQ
- `kira-queue` — consumes RabbitMQ jobs; runs Playwright crawling, gateway claim/callback calls, prediction engines
- `kira-data-manager` — DB-backed operational APIs (crawl dates, claims, failures, leagues, teams, stats); can ask
  `kira-producer` to requeue work
- `kira-crawl-java` — fetches/maps AiScore match & odds data via Playwright; scheduled crawling + gateway callbacks
- `kira-tool-service` — Google Drive / Scribd / Studocu / PDF utilities, Playwright-assisted extraction
- `kira-websocket` — thin Spring WebSocket transport (no DB/business logic)
- `kira-schema` — shared JPA entities/enums/DTOs and manually managed SQL migration scripts (the data contract other
  Java services depend on)

Frontend / mobile:
- `kira-ui` — Angular 21 web client (main app: auth, sports/crawl ops, predictions, finance, credit cards, travel,
  tools, admin), hash-based routing, standalone components + Signals
- `mobile-app` — Expo 54 / React Native app (Expo Router; routes in `app`, presentation in `components`, screens in
  `screens`, state in `contexts`/hooks)
- `kira-portfolio-3d` — separate Next.js portfolio site (has its own `AGENTS.md`/`CLAUDE.md`)

`kira-bank` is a **nested, independently-git-tracked sub-repository** (own `.git`) for a separate financial product:
- `kira-bank/kira-bank-service` — Java 25 modular-monolith API (domain/application/infrastructure/web layering per
  business capability), Flyway migrations under `src/main/resources/db/migration`
- `kira-bank/kira-bank-ui` — Angular 22 standalone client, strict TS, `resource.page` + `resource-definitions.ts` for
  shared CRUD UI
- `kira-bank/kira-life-mobile` — companion Expo app

Infra/ops (not application code): `docker-compose*.yml`, `nginx/`, `monitoring/` (Grafana/Loki/Promtail), `mysql/`
(primary+replica conf), `scripts/` (deploy, EC2 bootstrap, stack files), `docs/`.

## How instructions are layered

`AGENTS.md` at the repo root holds the general rules. **Every module directory additionally has its own
`AGENTS.override.md`** with module-specific scope, change rules, and the exact verification command for that module —
read the override for whatever module you're touching before making changes; it is more specific and takes
precedence over this file for that module. `kira-bank/AGENTS.override.md` governs cross-cutting `kira-bank` work, with
its own children's overrides for the individual apps.

## Build / verify commands

There is no root-level build. Default rule across the whole repo: **verify only the module you changed, and only by
the method its override specifies** — do not run tests, packaging, other modules, Docker, or full-stack builds unless
explicitly asked.

- Any Java module: `cd <module>` then `./mvnw.cmd compile` (Windows) — `kira-crawl-java` has no wrapper, use
  `mvn compile` instead.
- `kira-ui`, `mobile-app`, `kira-bank/kira-bank-ui`: do not run `npm run build`, lint, tests, or a dev server unless
  explicitly requested; a compile/build is not proof of correct UI behavior — inspect the rendered page/screen when
  runtime QA is authorized.
- `docker compose up -d` only when local infrastructure is actually needed for a manual runtime check.
- For any change to a message contract (queue name, DTO, routing key) between `kira-producer` and `kira-queue`, or an
  API contract shared with `kira-ui`/`mobile-app`/gateway consumers, inspect both sides of the contract in the same
  task even if you can't run the other module.

## Cross-cutting rules (apply everywhere in this repo)

- Money: use `BigDecimal`, never floating point, for anything financial (`kira-gateway` finance APIs, all of
  `kira-bank`). Preserve ledger append-only behavior, settlement idempotency, and ownership checks.
- Never log tokens, passwords, secrets, JWTs, cookies, financial payloads, document contents, or full third-party
  responses. Return domain-specific errors, not stack traces/SQL/internal paths.
- Schema changes are additive migrations, never edits to an already-applied migration (`kira-schema`:
  `src/main/resources/database/migrate`; `kira-bank-service`: Flyway under `src/main/resources/db/migration`).
- Queue/consumer code must be redelivery-safe (ack only after success, no duplicate side effects) and must not put
  slow browser/DB work on the RabbitMQ listener thread.
- Playwright-using services (`kira-queue`, `kira-crawl-java`, `kira-tool-service`) must release pages/contexts/streams
  on every path and respect configured pool/timeout limits.
- Secrets/config live in environment variables and `application.yml`/`.env`, never hard-coded; use the `.env*.example`
  files as the shape reference, never commit real secrets.
