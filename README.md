<div align="center">

# Kira App

**An open-source monorepo for distributed web crawling, sports data, and personal finance.**

A set of independently versioned Spring Boot services that crawl, queue, and serve sports data,
plus finance and productivity features — exposed through an Angular web client and an Expo mobile
app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Java 21](https://img.shields.io/badge/Java-21-orange.svg)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F.svg)](https://spring.io/projects/spring-boot)
[![Angular 21](https://img.shields.io/badge/Angular-21-DD0031.svg)](https://angular.dev)
[![Expo 54](https://img.shields.io/badge/Expo-54-000020.svg)](https://expo.dev)
[![MySQL 8](https://img.shields.io/badge/MySQL-8.0-4479A1.svg)](https://www.mysql.com/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3-FF6600.svg)](https://www.rabbitmq.com/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Getting Started](#getting-started) ·
[Architecture](#architecture) ·
[Contributing](CONTRIBUTING.md) ·
[Security](SECURITY.md)

</div>

---

Every module builds, runs, and is verified on its own — **there is no root build**.

## Key Features

- **Distributed crawling pipeline** — a scheduler publishes jobs to RabbitMQ; workers run
  Playwright-driven crawls, claim work through the gateway, and post results back.
- **Sports data & predictions** — matches, odds, leagues, teams, recent-form statistics,
  prediction engines and settlement.
- **Personal finance** — credit cards, statements, payments, MCC catalog, transactions and
  dashboards, all on `BigDecimal` with append-only ledger semantics.
- **Operational tooling** — crawl-date tracking, failure queues, requeue-on-demand, user admin.
- **Document & drive utilities** — Google Drive / Scribd / Studocu / PDF extraction.
- **Three clients** — Angular web app, Expo mobile app, and a standalone Next.js portfolio site.
- **A second product in the tree** — [`kira-bank` / *Kira Life*](#kira-bank-kira-life): credit
  cards, AI-assisted investment imports, health, travel and tutoring, in its own repository with
  its own stack.

---

## Table of Contents

- [Repository Layout](#repository-layout)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Ports Reference](#ports-reference)
- [Available Commands](#available-commands)
- [Verifying a Change](#verifying-a-change)
- [Testing](#testing)
- [Deployment](#deployment)
- [kira-bank (Kira Life)](#kira-bank-kira-life)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Repository Layout

```
kira-app/
├── kira-gateway/         Authenticated HTTP entry point (Java 21)
├── kira-producer/        Job scheduler → RabbitMQ publisher
├── kira-queue/           RabbitMQ consumer, Playwright crawling, prediction engines
├── kira-data-manager/    DB-backed operational APIs
├── kira-crawl-java/      AiScore match & odds crawler (no Maven wrapper)
├── kira-tool-service/    Drive / Scribd / Studocu / PDF utilities
├── kira-websocket/       Thin Spring WebSocket transport
├── kira-schema/          Shared JPA entities, enums, DTOs + manual SQL migrations
├── kira-ui/              Angular 21 web client
├── mobile-app/           Expo 54 / React Native app
├── kira-portfolio-3d/    Standalone Next.js + three.js portfolio site
├── kira-bank/            Nested, separately git-tracked product (Kira Life)
├── docker-compose*.yml   Local, crawl-only, and production stacks
├── nginx/                Reverse proxy config + templates
├── monitoring/           Grafana dashboards, Loki and Promtail configs
├── mysql/                Primary/replica MySQL configuration
├── scripts/              EC2 bootstrap, deploy, Swarm stack files
└── docs/                 Design and operations notes
```

### Backend modules

| Module | Responsibility |
| --- | --- |
| `kira-gateway` | Security/JWT, users, finance & dashboard APIs, travel checklists, karaoke and job-tracker features, crawl callbacks; orchestrates producer / data-manager / crawl / Gemini calls |
| `kira-producer` | Schedules and publishes crawl, prediction, backfill and settlement jobs to RabbitMQ |
| `kira-queue` | Consumes those jobs: Playwright crawling, gateway claim/callback calls, prediction engines |
| `kira-data-manager` | Operational APIs over the database — crawl dates, claims, failures, leagues, teams, stats; can ask the producer to requeue work |
| `kira-crawl-java` | Fetches and maps AiScore match & odds data via Playwright, on its own schedule |
| `kira-tool-service` | Google Drive / Scribd / Studocu / PDF utilities, Playwright-assisted extraction |
| `kira-websocket` | WebSocket transport only — no database, no business logic |
| `kira-schema` | The data contract: shared JPA entities/enums/DTOs and hand-managed SQL migration scripts |

### Client modules

| Module | Stack | Notes |
| --- | --- | --- |
| `kira-ui` | Angular 21, Tailwind 4, TypeScript | Standalone components + Signals, hash-based routing |
| `mobile-app` | Expo 54, React Native 0.81, React 19 | Expo Router; routes in `app/`, UI in `components/`, screens in `screens/`, state in `contexts/` and hooks |
| `kira-portfolio-3d` | Next.js 16, three.js | Independent site with its own `AGENTS.md` / `CLAUDE.md` |

---

## Tech Stack

- **Language (platform services)**: Java 21
- **Language (`kira-bank-service`)**: Java 25
- **Framework**: Spring Boot (Web, Security, Data JPA, AMQP, Actuator)
- **Messaging**: RabbitMQ 3 (management image)
- **Database**: MySQL 8
- **Browser automation**: Playwright (`kira-queue`, `kira-crawl-java`, `kira-tool-service`)
- **Web**: Angular 21 + Tailwind CSS 4 + TypeScript
- **Mobile**: Expo 54 / React Native 0.81 (Expo Router)
- **Reverse proxy**: nginx 1.27-alpine
- **Observability**: Grafana + Loki + Promtail
- **Packaging / deploy**: Docker Compose, Docker Hub (`kira2308/*`), EC2 via `scripts/deploy-ec2.sh`

---

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| JDK | 21 (25 for `kira-bank-service`) | All Java modules |
| Maven | Only for `kira-crawl-java` | Every other module ships `mvnw` / `mvnw.cmd` |
| Node.js | 20+ (22+ recommended) | `kira-ui`, `mobile-app`, `kira-portfolio-3d` |
| npm | 9+ | Same |
| Docker Desktop | Recent | MySQL, RabbitMQ, nginx, full-stack runs |
| MySQL 8 | Optional | Only if you run the database outside Docker |

Playwright browsers are downloaded on first run by the services that use them; that first start
is slow and needs network access.

---

## Getting Started

### 1. Clone

```bash
git clone https://github.com/pvhao2002/kira-app.git
cd kira-app
```

`kira-bank/` is a nested repository with its own `.git`. Clone or pull it from inside that
directory; this repo's git does not track its contents.

### 2. Configure the environment

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

`.env` is read by Docker Compose from the repo root and is already in `.gitignore`. At minimum,
change `APP_SECURITY_JWT_SECRET` and the MySQL passwords before using anything beyond a throwaway
local database. See [Environment Variables](#environment-variables) for the full reference.

### 3. Start infrastructure

```bash
docker compose up -d
```

This brings up **MySQL, RabbitMQ and nginx only** — the application containers sit behind the
`apps` Compose profile, so you can run services from your IDE against shared infrastructure.

Verify:

```bash
docker compose ps
docker compose logs -f mysql
```

- MySQL: `localhost:3310` (container port 3306), database `kira`, user `kira_user`
- RabbitMQ: AMQP `localhost:5672`, management UI <http://localhost:15672> (`guest` / `guest`)
- nginx: <http://localhost:8800> (`NGINX_PORT`; the compose default is `80`, and `.env.example`
  overrides it to `8800` because Windows often has port 80 held by HTTP.sys or IIS)

To run the application containers too:

```bash
docker compose --profile apps up -d --build
```

### 4. Load the schema

`kira-schema` holds hand-managed SQL under `kira-schema/src/main/resources/database`. There is no
automatic migration runner for the platform services — apply the scripts you need against the
`kira` database, for example:

```bash
docker exec -i kira-mysql mysql -ukira_user -pkira_password kira < kira-schema/src/main/resources/database/script.sql
```

Individual feature migrations live in `.../database/migrate/`. Read
`kira-schema/src/main/resources/database/README.md` before applying anything to a populated
database.

### 5. Run a backend service

Each Java module is a standalone Spring Boot app. From the module directory:

```bash
cd kira-gateway
./mvnw.cmd spring-boot:run      # Windows
./mvnw spring-boot:run          # macOS / Linux
```

`kira-crawl-java` has no wrapper — use a locally installed Maven:

```bash
cd kira-crawl-java
mvn spring-boot:run
```

Health endpoints, once a service is up:

```bash
curl http://localhost:6868/gateway/actuator/health
curl http://localhost:7777/data/actuator/health
curl http://localhost:4000/actuator/health
```

### 6. Run the web client

```bash
cd kira-ui
npm install
npm start          # ng serve --proxy-config proxy.conf.js --host 0.0.0.0
```

Open <http://localhost:4200>. `proxy.conf.js` forwards API calls to the backend, so the gateway
(and usually nginx) should be running first.

### 7. Run the mobile app

```bash
cd mobile-app
npm install
npm start          # expo start --lan -c
```

Then press `a` for Android, `i` for iOS, or scan the QR code with Expo Go. `--lan` means the
device must be on the same network as your machine, and the API base URL must point at your
machine's LAN address rather than `localhost`.

---

## Architecture

### High-level flow

```
                       ┌──────────────┐        ┌─────────────────┐
  Browser / Mobile ──▶ │    nginx     │ ──────▶│  kira-gateway   │──┐
                       └──────┬───────┘        └─────────────────┘  │
                              │                                     │ JPA
                              ├──────────────▶ kira-data-manager ───┤
                              ├──────────────▶ kira-tool-service    │
                              └──────────────▶ kira-ui (static)     ▼
                                                               ┌─────────┐
  kira-producer ──publish──▶ RabbitMQ ──consume──▶ kira-queue ─│  MySQL  │
        ▲                 (crawl_exchange)            │        └─────────┘
        │                                             │ Playwright
        └────── requeue ◀── kira-data-manager         ▼
                                              AiScore / external sites
                                                      │
                                       crawl callback ▼
                                                 kira-gateway
```

### nginx routing

`nginx/templates/kira-services.conf.template` maps a single host port onto every service:

| Path | Upstream | Default target |
| --- | --- | --- |
| `/api/` | kira-service | `host.docker.internal:2308` |
| `/queue/` | kira-queue | `host.docker.internal:2323` |
| `/gateway/` | kira-gateway (round-robin over two instances) | `:6868`, `:6869` |
| `/data/` | kira-data-manager (round-robin over two instances) | `:7777`, `:7778` |
| `/tool-service/` | kira-tool-service | `:1406` |
| `/` | kira-ui | `:4200` |
| `/health` | nginx itself | static `200` |

Upstream hosts default to `host.docker.internal`, i.e. services running on your host (IntelliJ,
`spring-boot:run`). Override the `KIRA_*_HOST` variables to point nginx at containers instead.

### Messaging contract (`kira-producer` → `kira-queue`)

All jobs go through a single exchange, `crawl_exchange`:

| Queue | Routing key | Purpose |
| --- | --- | --- |
| `crawlByDate` | `crawl.crawlByDate` | Crawl every match on a given date |
| `event` | `crawl.event` | Crawl one event's details and odds |
| `prediction` | `crawl.prediction` | Run prediction engines for an event |
| `prediction-settle` | `crawl.prediction-settle` | Settle finished predictions |
| `upcoming_queue` | — | Marker queue for work that has been enqueued |

Any change to a queue name, routing key, or message DTO must be made on **both** sides in the
same task, even when only one module is being compiled.

### Service layering

Java services follow standard Spring layering — `rest`/`controller`, `service`, `repository`,
`config`, and DTOs with matching suffixes. `kira-gateway` additionally groups by feature:

```
com/db/kiragateway/
├── auth/              Authentication and JWT issuing
├── config/            Security, CORS, HTTP clients, scheduling
├── credit/            Credit cards, statements, payments, MCC
├── transaction/       Financial transactions and ledger
├── dashboard/         Aggregated dashboard queries
├── predictionstats/   Prediction reporting
├── travelchecklist/   Travel checklists
├── karaoke/           Karaoke favourites
├── jobtracker/        Job-application tracking
├── useradmin/         User administration
└── rest/ service/ repository/ dto/ util/
```

### Web client structure

```
kira-ui/src/app/
├── app.routes.ts      Hash-based route table (dashboard, matches, results,
│                      bank-card, transactions, statements, mcc, tool, leagues,
│                      users, soccer, crawl-dates, event-*, teams, statistics…)
├── components/        Standalone feature components
├── services/          HTTP + state services built on Signals
├── guards/            Route guards
└── config/ utils/
```

### Data

MySQL 8 is the single source of truth. `kira-schema` owns the entities and the SQL scripts; other
Java modules depend on it rather than redefining entities. Compose tunes MySQL for a
workstation-sized crawl workload (4 GB buffer pool, 230 max connections, slow-query log at
500 ms) — see the `command:` block in `docker-compose.yml`.

---

## Environment Variables

All of the following are read from `.env` at the repo root by Docker Compose, and can equally be
exported into the environment of a service you run directly.

### Database

| Variable | Description | Default |
| --- | --- | --- |
| `DB_PORT_PUBLISHED` | Host port for MySQL | `3310` |
| `DB_ROOT_PASSWORD` | MySQL root password | `1234` |
| `DB_NAME` | Database created on first boot | `kira` |
| `DB_APP_USER` | Application user | `kira_user` |
| `DB_APP_PASSWORD` | Application password | `kira_password` |

### RabbitMQ

| Variable | Description | Default |
| --- | --- | --- |
| `RABBITMQ_DATA_DIR` | Bind-mount for broker data | `./data/rabbitmq` |
| `RABBITMQ_LOG_DIR` | Bind-mount for broker logs | `./data/rabbitmq-logs` |

Credentials are fixed at `guest` / `guest` in `docker-compose.yml`; AMQP `5672`, UI `15672`.

### Gateway

| Variable | Description | Default |
| --- | --- | --- |
| `APP_SECURITY_JWT_SECRET` | HS256 signing secret — **change this**; use 32+ random characters | placeholder |
| `APP_SECURITY_COOKIE_SECURE` | Send auth cookies only over HTTPS | `false` locally |
| `APP_SECURITY_CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | `http://localhost:4200` |
| `APP_DATA_MANAGER_BASE_URL` | Where the gateway reaches data-manager | `http://nginx/data` |
| `APP_KIRA_PRODUCER_BASE_URL` | Where the gateway reaches the producer | `http://kira-producer:2311` |

### Producer scheduling

| Variable | Description | Default |
| --- | --- | --- |
| `KIRA_PRODUCER_CRAWL_SCHEDULE_ENABLED` | Master switch for scheduled crawling | `true` |
| `KIRA_PRODUCER_CRAWL_SCHEDULE_DATE_ENABLED` | Date-sweep schedule | commented out |
| `KIRA_PRODUCER_CRAWL_SCHEDULE_EVENT_ENABLED` | Per-event schedule | commented out |
| `KIRA_PRODUCER_SOCCER_TEAM_RECENT_STAT_ENABLED` | Recent-form stats job | `true` |
| `KIRA_PRODUCER_SOCCER_TEAM_RECENT_STAT_CRON` | Cron for that job | `0 30 2 * * *` |

### Queue / Playwright

| Variable | Description | Default |
| --- | --- | --- |
| `PLAYWRIGHT_HEADLESS` | Run browsers headless | `true` |
| `AISCORE_VERIFICATION_TIMEOUT_MS` | Verification step timeout | `120000` |
| `KIRA_QUEUE_REMOTE_DISPLAY_ENABLED` | Enable the VNC debugging overlay | `false` |
| `KIRA_QUEUE_VNC_PASSWORD_FILE` | Password file for that overlay — keep it out of git | `../.secrets/kira-queue-vnc-password` |

### nginx

| Variable | Description | Default |
| --- | --- | --- |
| `NGINX_PORT` | Host port for the proxy | `80` in compose, `8800` in `.env.example` |
| `NGINX_SERVER_NAME` | `server_name` directive | `localhost kira.local` |
| `KIRA_*_HOST` / `KIRA_*_PORT` | Upstream host/port per service | `host.docker.internal` + the service port |

### Other env files

| File | Use |
| --- | --- |
| `.env.example` | The local template — copy to `.env` |
| `.env.compose-apps.example` | Overrides for running every app inside Compose (service names instead of `host.docker.internal`) |
| `.env.host-dev.example` | Running services on the host against containerised infrastructure |
| `.env.ec2.example` | Production/EC2 deployment — copy to `.env.ec2` |

Never commit a real `.env`. Secrets belong in environment variables and `application.yml`
placeholders, never hard-coded in source.

---

## Ports Reference

| Service | Port | Context path |
| --- | --- | --- |
| nginx | `8800` (or `80`) | — |
| kira-ui (dev server) | `4200` | — |
| kira-gateway (instance 1 / 2) | `6868` / `6869` | `/gateway` |
| kira-data-manager (1 / 2) | `7777` / `7778` | `/data` |
| kira-producer | `2311` | `/producer` |
| kira-queue | `2323` | `/queue` |
| kira-tool-service | `1406` | `/tool-service` |
| kira-crawl-java | `4000` | — |
| kira-websocket | `8080` (Spring default) | — |
| MySQL | `3310` → `3306` | — |
| RabbitMQ | `5672`, UI `15672` | — |

---

## Available Commands

### Java modules

| Command | Description |
| --- | --- |
| `./mvnw.cmd compile` | **The standard verification** for a backend change |
| `./mvnw.cmd spring-boot:run` | Run the service locally |
| `./mvnw.cmd test` | Run that module's tests (only when explicitly asked for) |
| `./mvnw.cmd package -DskipTests` | Build a jar |
| `mvn compile` | Same, for `kira-crawl-java`, which has no wrapper |

### kira-ui

| Command | Description |
| --- | --- |
| `npm start` | Dev server on `:4200` with the API proxy |
| `npm run build` | Production build |
| `npm run watch` | Rebuild on change (development configuration) |
| `npm test` | Karma/Jasmine runner (no specs committed yet) |

### mobile-app

| Command | Description |
| --- | --- |
| `npm start` | Expo dev server over LAN, cache cleared |
| `npm run android` / `npm run ios` / `npm run web` | Open on a specific target |
| `npm run lint` | Expo lint |
| `npm run reset-project` | Reset to the blank Expo starter (destructive) |

### Docker Compose

| Command | Description |
| --- | --- |
| `docker compose up -d` | MySQL + RabbitMQ + nginx |
| `docker compose --profile apps up -d --build` | Also build and run UI, gateways, data-managers, producer |
| `docker compose -f docker-compose.crawl.yml up -d` | Crawl-only stack |
| `docker compose down` | Stop (add `-v` to drop the MySQL volume — destroys local data) |
| `docker compose logs -f <service>` | Tail a service |

---

## Verifying a Change

The repo-wide rule: **verify only the module you changed, and only by the method its
`AGENTS.override.md` specifies.**

- Java module → `./mvnw.cmd compile` in that module's directory. Compile success is the required
  verification; do not run tests, packaging, other modules, Docker, or full-stack builds unless
  asked.
- `kira-ui`, `mobile-app`, `kira-bank/kira-bank-ui` → do not run builds, linting, tests, or a dev
  server unless asked. A build is not proof of correct UI behaviour; inspect the rendered
  page/screen when runtime QA is authorised.
- `docker compose up -d` only when infrastructure is genuinely needed for a manual runtime check.
- Contract changes (queue name, DTO, routing key between producer and queue; any API shared with
  `kira-ui`, `mobile-app`, or gateway consumers) → inspect **both** sides in the same task, even
  when you cannot run the other module.

Instructions are layered: `AGENTS.md` at the root holds the general rules, and every module
directory has an `AGENTS.override.md` that is more specific and takes precedence for that module.
Read the override before changing a module. `CLAUDE.md` mirrors this for Claude Code.

---

## Testing

Tests exist but are sparse and are not part of the default verification loop:

| Module | Test classes |
| --- | --- |
| `kira-queue` | 7 |
| `kira-gateway` | 5 |
| `kira-crawl-java` | 2 |
| `kira-websocket` | 1 |
| others | none yet |

```bash
cd kira-queue
./mvnw.cmd test                                   # whole module
./mvnw.cmd test -Dtest=SomeServiceTest            # one class
```

Test classes end in `Test` and live under `src/test/java`, mirroring the main package tree.
`kira-ui` has a Karma runner configured but no committed specs.

---

## Deployment

### Images

Production images are published to Docker Hub under `kira2308/`: `kira-ui`, `kira-gateway`,
`kira-data-manager`, `kira-crawl-java`, and the `kira-bank` images.

### EC2 (Docker Compose)

`docker-compose.prod.yml` + `scripts/deploy-ec2.sh` are the production path:

```bash
# first time on a fresh box
bash scripts/ec2-bootstrap.sh

# configure
cp .env.ec2.example .env.ec2

# deploy / update
bash scripts/deploy-ec2.sh
```

The script pulls the latest images, runs `docker compose up -d --remove-orphans`, health-checks
`kira-ui`, `kira-gateway`, `kira-data-manager` and `kira-crawl-java`, prunes dangling images, and
prints the running containers. Override `COMPOSE_FILE` or `ENV_FILE` to target a different stack.

### Swarm / Portainer

`scripts/stack*.yml` hold Docker Swarm stack definitions (full stack, RabbitMQ only, producer +
queue, and a remote producer/queue variant). `docs/portainer-ec2-setup.md` walks through the
Portainer setup.

### CI

`.github/workflows/deploy-kira-bank.yml` builds and pushes the **kira-bank** service and UI images
when their paths change on `main`/`master`. The platform services are built and deployed manually
via the scripts above.

### Observability

`monitoring/` holds Loki, Promtail (single-host and distributed) and Grafana configuration.
`nginx/`, `mysql/` (primary + replica configs) and `docs/` cover the rest of the operational setup.

---

## kira-bank (Kira Life)

`kira-bank` is a **separate product with its own git repository**, nested inside this one. It is a
personal finance and life-management app branded *Kira Life*; the directory, Java packages,
database and Docker image names keep the original `kira-bank` naming for deployment
compatibility. It shares no database, broker, or deploy pipeline with the platform above.

### What it does

Kira Life is a single-user-per-account assistant for the things that otherwise live in a dozen
spreadsheets:

| Area | What it covers |
| --- | --- |
| **Credit cards** | Cards linked to banks, statements and billing cycles, payments, credit limits shared per bank rather than per card, benefits, and a utilisation dashboard |
| **Investments** | Account profiles and transaction history imported from screenshots by AI — every extracted row waits for human review before it is saved. History is independent: no balance, no capital, no ledger entries |
| **Health** | Body profile, BMI, calorie targets, AI-drafted meal and workout plans, a daily journal, and Apple Health data synced from a companion iPhone app |
| **Travel** | Trips, itineraries, packing checklists, group cost splitting, tickets and bookings, place maps, and a departure countdown |
| **Lodging & tutoring** | Rental/stay records, and a tutoring schedule with weekly hours, fees, and conflict detection |
| **Personal** | Karaoke favourites, a job-application tracker, and a password vault |
| **Shared** | Attachments in Cloudflare R2, notifications, login-visit history, analytics, an admin area, and a combined overview dashboard |

The AI layer runs on Cloudflare Workers AI with per-account failover, processes at most three
images per request every three hours, and never writes an extracted value without confirmation.
Stored third-party credentials are encrypted with a master key held outside the database.

Main API surface (all under `/api/v1`): `/auth/*`, `/credit-cards`, `/statements`, `/payments`,
`/investment/accounts`, `/attachments`, `/dashboards/*`, `/admin/cloudflare-accounts`. Full
endpoint documentation is in `kira-bank/docs/api`.

### How it is built

| Module | Stack |
| --- | --- |
| `kira-bank-service` | Java 25, Spring Boot 3.5 — modular monolith, JWT security, JPA, Flyway, MySQL, OpenAPI |
| `kira-bank-ui` | Angular 22 standalone, strict TypeScript, Signals, lazy routes, light/dark |
| `kira-life-mobile` | Expo 57 / React Native companion app |

The backend is organised by business capability rather than by layer — `creditcard`,
`investment`, `travel`, `lodging`, `health`, `tutoring`, `jobtracker`, `karaoke`,
`passwordvault`, `publiccatalog`, `notification`, `attachment`, `analytics`, `ai`, `dashboard`,
`identity`, `bank` — each owning its own `domain` / `application` / `infrastructure` / `web`
packages. Credit-card and investment data stay independent: no cross-domain foreign keys and no
hidden write coupling.

### Running it

```bash
cd kira-bank
cp .env.example .env                                # then change every secret

cd kira-bank-service && ./mvnw spring-boot:run      # API :8080, Swagger at /swagger-ui.html
cd kira-bank-ui && npm install && npm start         # UI  :4200
```

Or the whole stack from `kira-bank/`:

```bash
docker compose up --build                           # UI :4200, API :8080, MySQL :3307
```

Development seed accounts are created only when `app.seed-development-users=true` (the default in
development, always false in production): `admin@kira.local` / `KiraAdmin123!` and
`user@kira.local` / `KiraUser123!`.

Schema changes are Flyway migrations under `kira-bank-service/src/main/resources/db/migration` —
add a new versioned file, never edit an applied one. `AI_CREDENTIAL_ENCRYPTION_KEY` (Base64,
32 bytes) is the one master key that must live outside the database; Cloudflare account, Workers
AI and R2 credentials are managed at runtime under `/app/admin/cloudflare-accounts`.

Architecture, ERD, business rules, API and deployment notes live in `kira-bank/docs`. See
`kira-bank/README.md` (Vietnamese) and `kira-bank/AGENTS.override.md` for the full picture.

Because it carries its own `.git`, commits, branches and pushes for `kira-bank` happen from
inside that directory — not from this repo.

---

## Troubleshooting

### `docker compose up -d` starts only three containers

Expected. The application services are behind the `apps` profile:

```bash
docker compose --profile apps up -d --build
```

### Port 80 is already in use (Windows)

HTTP.sys or IIS usually holds it. `.env.example` already sets `NGINX_PORT=8800`; make sure your
`.env` has it, then `docker compose up -d nginx`.

### nginx returns 502 for `/gateway/` or `/data/`

The upstreams default to `host.docker.internal`, i.e. services running on your **host**. Either
start the service locally, or point the variable at a container:

```bash
KIRA_GATEWAY_HOST_1=kira-gateway-1
KIRA_GATEWAY_PORT_1=6868
```

### A service cannot connect to MySQL

MySQL is published on **3310**, not 3306. From the host use
`DB_PRIMARY_HOST=localhost DB_PRIMARY_PORT=3310`; from another container use `mysql:3306`. Check
the container is healthy with `docker compose ps` — the app user is created on first boot only,
so if you changed `DB_APP_USER` after the volume existed, recreate it with
`docker compose down -v` (this deletes local data).

### `Unknown column` / `Table doesn't exist`

There is no automatic migration runner for the platform services. Apply the relevant scripts from
`kira-schema/src/main/resources/database/migrate/` by hand.

### Jobs are published but nothing is crawled

1. Check the RabbitMQ UI (<http://localhost:15672>) for depth on `crawlByDate`, `event`,
   `prediction`, `prediction-settle`.
2. Confirm `kira-queue` is running and connected — a consumer should be attached to each queue.
3. Confirm `KIRA_PRODUCER_CRAWL_SCHEDULE_ENABLED` is `true` if you expect scheduled work.

### Playwright fails to start or times out

The first run downloads browsers — allow network access and be patient. For a stuck crawl, set
`PLAYWRIGHT_HEADLESS=false` locally to watch it, and raise `AISCORE_VERIFICATION_TIMEOUT_MS`.
Pages, contexts and streams must be released on every path; a leak shows up as pool exhaustion
after a few dozen jobs.

### `mvnw` is not recognised

Use `./mvnw.cmd` on Windows and `./mvnw` elsewhere. `kira-crawl-java` ships no wrapper at all —
use a locally installed `mvn`.

### The mobile app cannot reach the API

`expo start --lan` serves over your LAN, so `localhost` inside the app points at the phone. Set
the API base URL to your machine's LAN IP and make sure the gateway is bound to `0.0.0.0`.

---


## Contributing

Contributions are welcome. Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** — it covers the branch
and commit conventions, the layered `AGENTS.override.md` instructions, the verification rule, and
the non-negotiables (money handling, logging, migrations, redelivery safety, Playwright cleanup).

Quick version:

1. Open an issue before large or architectural work.
2. Branch from `main`, keep one concern per pull request.
3. Read the target module's `AGENTS.override.md` before changing it.
4. Verify only the module you changed — `./mvnw.cmd compile` for Java.
5. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(kira-gateway): …`.

Everyone participating is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security
issues go through [SECURITY.md](SECURITY.md), never a public issue.

### Good first contributions

- Test coverage — most modules have none; `kira-producer`, `kira-data-manager`, `kira-tool-service`
  and `kira-schema` are entirely untested.
- Documentation for individual modules and their APIs.
- Replacing the hand-run SQL scripts in `kira-schema` with a proper migration tool.
- Frontend specs for `kira-ui`, which has a Karma runner configured but no committed tests.

---

## Roadmap

Not a commitment, but the direction of travel:

- [ ] Automated migrations for the platform services, replacing hand-applied SQL
- [ ] CI for the platform modules — today only `kira-bank` has a workflow
- [ ] Meaningful test coverage across the backend services
- [ ] OpenAPI documentation published for the gateway and data-manager
- [ ] A single Compose profile that brings up the whole stack reproducibly from images

Have an opinion on the ordering? Open a
[discussion](https://github.com/pvhao2002/kira-app/discussions).

---

## License

Released under the [MIT License](LICENSE) — © 2026 Pham Van Hao.

You may use, modify, and distribute this software, including commercially, provided the copyright
notice and licence text are retained. The software comes with no warranty.

**Third-party data**: some modules crawl external sites (AiScore, Google Drive, Scribd, Studocu).
The MIT licence covers this source code only, not the data those services publish. You are
responsible for complying with their terms of service, robots directives, and rate limits, and with
the data-protection law in your jurisdiction, when you run any crawler in this repository.

`kira-bank/` is a separate repository with its own licensing — check it there.

---

## Acknowledgements

Built with [Spring Boot](https://spring.io/projects/spring-boot),
[Angular](https://angular.dev), [Expo](https://expo.dev),
[Playwright](https://playwright.dev), [RabbitMQ](https://www.rabbitmq.com/),
[MySQL](https://www.mysql.com/), and [Grafana](https://grafana.com/) with Loki and Promtail.

Maintained by [@pvhao2002](https://github.com/pvhao2002). Questions and ideas belong in
[Issues](https://github.com/pvhao2002/kira-app/issues) or
[Discussions](https://github.com/pvhao2002/kira-app/discussions).
