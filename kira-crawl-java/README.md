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
| `GET /matches/odds?event_link=https://www.aiscore.com/...` | Crawl odds for one match (v1: isolated Playwright + network capture) |
| `GET /matches/odds/v2?event_link=https://www.aiscore.com/...` | Crawl odds for one match (v2: warm Playwright lane + console fetch, no per-request navigation) |
| `GET /matches/odds?event_link=...&has_odds_corner=false` | Skip corner odds detail capture when the match has no corner market |

## Concurrency

Production `/matches` and `/matches/odds/v2` use **dedicated Playwright crawl lanes** (`PlaywrightCrawlLanes`):

| Lane | Driver thread | API |
|------|---------------|-----|
| `playwright-matches-driver` | 1 warm browser context | `GET /matches` |
| `playwright-odds-driver` (×N, max 5) | N warm browser contexts | `GET /matches/odds/v2` |

`GET /matches/odds` (v1) still spins up an isolated Playwright instance per request.

Each lane processes requests **sequentially** on its driver thread. ODDS lanes are **warmed to `https://www.aiscore.com/`** at startup; v2 crawls use in-page `fetch()` only (no navigation to match/odds pages). With `AISCORE_ODDS_CONCURRENCY=5`, up to **5 odds v2 crawls** run in parallel (round-robin across lanes). The matches lane runs in parallel with odds lanes.

Non-essential assets (`image`, `font`, `media`) are blocked via lean network routing.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLAYWRIGHT_UTIL_LEAN_NETWORK` | `true` | Block heavy assets to reduce network delay |
| `AISCORE_COOKIE` | — | Session cookies (replaces on-disk profile for Cloudflare) |

HTTP handlers use virtual threads (`spring.threads.virtual.enabled=true`); Playwright calls are marshaled to each lane's dedicated driver thread for thread-safety.

`PLAYWRIGHT_UTIL_CONTEXT_POOL_SIZE` applies only to legacy `PlaywrightUtil.withCrawlPage` / dev helpers, not production crawl lanes.

| `AISCORE_ODDS_CONCURRENCY` | `5` | Number of warm ODDS Playwright lanes for `/matches/odds/v2` (capped at 5) |

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `KIRA_CRAWL_PORT` / `PORT` | `3000` | HTTP port |
| `PLAYWRIGHT_HEADLESS` | `true` | Headless browser |
| `PLAYWRIGHT_CHANNEL` | — | e.g. `chrome` |
| `AISCORE_BROWSER_TIMEOUT_MS` | `80000` | Per-step Playwright timeout (navigate, waitForResponse, …) |
| `AISCORE_MATCHES_ASYNC_TIMEOUT_MS` | `180000` | HTTP async timeout for `GET /matches` |
| `AISCORE_ODDS_ASYNC_TIMEOUT_MS` | `300000` | HTTP async timeout for `GET /matches/odds` (align with kira-queue `read-timeout-ms`) |
| `AISCORE_COOKIE` | — | Pre-seed Cloudflare/session cookies (required if challenged) |
| `AISCORE_USER_AGENT` | Chrome UA | Override user agent |
| `PLAYWRIGHT_UTIL_CONTEXT_POOL_SIZE` | `2` | Legacy `PlaywrightUtil.withCrawlPage` context pool; production crawl lanes ignore it |
| `PLAYWRIGHT_UTIL_LEAN_NETWORK` | `true` | Block image/font/media on crawl pages |

### Multiple instances

Run each instance on a **different port** (or set `PLAYWRIGHT_INSTANCE_ID` explicitly). Example:

```bash
KIRA_CRAWL_PORT=4000 mvn spring-boot:run &
KIRA_CRAWL_PORT=4001 mvn spring-boot:run &
KIRA_CRAWL_PORT=4002 mvn spring-boot:run &
KIRA_CRAWL_PORT=4003 mvn spring-boot:run &
```

Each JVM is isolated by process; run different ports when scaling horizontally.

## PlaywrightUtil

Shared crawl runtime for dev load tests and legacy helpers. Production `/matches` and `/matches/odds` use **`PlaywrightCrawlLanes`** instead (two warm browser lanes).

## Playwright load test API

Dev endpoint to benchmark **5 URLs in parallel** — each URL runs on its own platform thread with a dedicated `Playwright.create()` (`executionMode: perThreadPlaywright`), per [Playwright Java multithreading](https://playwright.dev/java/docs/multithreading). Shared `PlaywrightUtil` uses a single `playwright-driver` thread instead. Swagger tag `test`:

```bash
curl "http://localhost:4000/test/playwright/load"
curl "http://localhost:4000/test/playwright/load?urls=https://www.aiscore.com/20180101,https://www.aiscore.com/20180102,https://www.aiscore.com/20180103,https://www.aiscore.com/20180104,https://www.aiscore.com/20180105"
curl "http://localhost:4000/test/playwright/load?timeout_ms=60000"
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLAYWRIGHT_TEST_API_ENABLED` | `true` | Set `false` in production to hide `/test/playwright/*` and `/test/matches/*` |

Response JSON includes `totalDurationMs`, `executionMode`, `poolSize`, and per-link `durationMs`, `title`, `ok`, `error`.

## Matches API benchmark

E2E benchmark: **5 parallel HTTP GETs** to `/matches` (default dates `20260101`–`20260105`, query `raw=false`, `tz=07:00`, `lang=2`, `sport_id=1`). Measures wall-clock API latency under concurrent load (Playwright still serializes on the shared driver).

```bash
curl "http://localhost:4000/test/matches/benchmark"
curl "http://localhost:4000/test/matches/benchmark?dates=20260101,20260102,20260103,20260104,20260105"
curl "http://localhost:4000/test/matches/benchmark?base_url=http://localhost:4000&timeout_ms=120000"
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `MATCHES_BENCHMARK_BASE_URL` | (empty) | Target base URL; if empty, uses `http://localhost:{server.port}` |

Response JSON includes `totalDurationMs`, `baseUrl`, and per-date `durationMs`, `httpStatus`, `responseBytes`, `ok`, `error` (no full match payload).

### 3 instances in parallel (shell)

With three JVMs on ports 4001–4003:

```bash
bash scripts/parallel-matches-instances.sh
```

Override URLs if needed: `URL_4001=... URL_4002=... URL_4003=... bash scripts/parallel-matches-instances.sh`

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
