# Kira Crawl NestJS API

NestJS service that proxies AiScore matches data and decodes the `application/octet-stream` protobuf payload using `protobuf.json`.

## Run

```bash
npm install
npx playwright install chromium
npm run build
npm start
```

## Matches API

```http
GET /matches?date=20180101&sport_id=1&lang=2&tz=07:00
```

Filter one match and return database-friendly rows:

```http
GET /matches?date=20180101&sport_id=1&lang=2&tz=07:00&match_id=g6763i4gwvvso7r
```

The response maps AiScore data into `league`, `homeTeam`, `awayTeam`, `event`, `result`, and `odds` objects that line up with the current database tables.

The service calls:

```text
https://api.aiscore.com/v1/web/api/matches
```

Then it:

1. Reads the response as bytes.
2. Gunzips the body when it still has the gzip magic header.
3. Decodes it as `onescore.app.v1.Matches` with `protobufjs`.
4. Returns a compact JSON list of matches.

For debugging the decoded protobuf object:

```http
GET /matches?date=20180101&sport_id=1&lang=2&tz=07:00&raw=true
```

## AiScore Cloudflare Session

Direct server requests can be blocked by Cloudflare with `403`. The service falls back to Playwright by opening the public AiScore date page and capturing the `matches` API response from browser network traffic.

The browser fallback uses a persistent profile at `.playwright/aiscore-profile`. To solve a challenge once and reuse that session, run the API with a visible browser:

```bash
PLAYWRIGHT_HEADLESS=false AISCORE_BROWSER_TIMEOUT_MS=180000 npm start
```

If the browser fallback is still challenged, pass an existing browser session through environment variables:

```bash
AISCORE_COOKIE="..." AISCORE_USER_AGENT="..." npm start
```

Optional headers:

```bash
AISCORE_REFERER="https://www.aiscore.com/20180101"
AISCORE_ACCEPT_LANGUAGE="en-US,en;q=0.9"
```
