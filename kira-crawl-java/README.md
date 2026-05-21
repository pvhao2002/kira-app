# Kira Crawl Java

Spring Boot drop-in replacement for the NestJS `kira-crawl` service. Exposes the same HTTP API on port **3000** for `kira-queue` via `APP_KIRA_CRAWL_BASE_URL`.

## Requirements

- JDK 21
- Maven 3.9+
- Playwright Chromium

## Run locally

```bash
cd kira-crawl-java
mvn spring-boot:run
```

Swagger UI: http://localhost:3000/docs  
Health: http://localhost:3000/actuator/health

## API

| Endpoint | Description |
|----------|-------------|
| `GET /matches?date=YYYYMMDD&sport_id=1&lang=2&tz=07:00` | Crawl match list for a date |
| `GET /matches/odds?event_link=https://www.aiscore.com/...` | Crawl odds for one match |
| `GET /aiscore/raw?publicPageUrl=...&apiUrl=...` | Generic protobuf proxy |

## Concurrency

Matches and odds crawls use **separate Playwright drivers and browser pools** (one `Playwright.create()` per API type) so parallel `/matches` + `/matches/odds` in the same JVM does not corrupt the driver:

- `AISCORE_MATCHES_CONCURRENCY` (default `1`)
- `AISCORE_ODDS_CONCURRENCY` (default `1`)
- `AISCORE_RAW_CONCURRENCY` (default `1`)

Each request creates and closes its own persistent Chromium context. Profiles are separated by **JVM** (`port` + **PID**), API type, and pool slot under `.playwright/{port4000_pid12345}_{matches|odds|raw}_s0` so multiple JVMs never share the same Chromium user-data directory—even when two instances use the same HTTP port by mistake.

Virtual threads are enabled for the HTTP layer (`spring.threads.virtual.enabled=true`).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `KIRA_CRAWL_PORT` / `PORT` | `3000` | HTTP port |
| `PLAYWRIGHT_HEADLESS` | `true` | Headless browser |
| `PLAYWRIGHT_CHANNEL` | — | e.g. `chrome` |
| `AISCORE_BROWSER_TIMEOUT_MS` | `80000` | Per-step Playwright timeout (navigate, waitForResponse, …) |
| `AISCORE_MATCHES_ASYNC_TIMEOUT_MS` | `180000` | HTTP async timeout for `GET /matches` |
| `AISCORE_ODDS_ASYNC_TIMEOUT_MS` | `300000` | HTTP async timeout for `GET /matches/odds` (align with kira-queue `read-timeout-ms`) |
| `AISCORE_COOKIE` | — | Pre-seed Cloudflare/session cookies |
| `AISCORE_USER_AGENT` | Chrome UA | Override user agent |
| `AISCORE_PROFILE_BASE_DIR` | `.playwright` | Browser profile root |
| `PLAYWRIGHT_INSTANCE_ID` / `KIRA_CRAWL_INSTANCE_ID` | — | Optional label; path always includes PID (e.g. `port4000_pid12345_matches_s0`) |

### Multiple instances

Run each instance on a **different port** (or set `PLAYWRIGHT_INSTANCE_ID` explicitly). Example:

```bash
KIRA_CRAWL_PORT=4000 mvn spring-boot:run &
KIRA_CRAWL_PORT=4001 mvn spring-boot:run &
KIRA_CRAWL_PORT=4002 mvn spring-boot:run &
KIRA_CRAWL_PORT=4003 mvn spring-boot:run &
```

Do not point two JVMs at the same profile directory; Chromium locks the user-data folder and Playwright may fail with errors such as `Object doesn't exist: tracing@...`.

## Protobuf decode

AiScore protobuf uses the full `protobuf.json` schema from `kira-crawl`. Decoding is Java-native and runs in-process, with no Node.js/protobufjs runtime dependency.

## Docker

```bash
docker build -t kira-crawl-java .
docker run --rm -p 3000:3000 kira-crawl-java
```

## Integration with kira-queue

Point kira-queue to this service:

```yaml
app:
  kira-crawl:
    base-url: http://localhost:3000
```

No code changes required in `KiraCrawlClient`.
