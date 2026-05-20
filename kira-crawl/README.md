# Kira Crawl NestJS API

NestJS service that proxies AiScore matches data and decodes the `application/octet-stream` protobuf payload using `protobuf.json`.

## Run

```bash
npm install
npx playwright install chromium
npm run build
npm start
```

## Swagger UI

Once the service is running, open the interactive API docs at:

```
http://localhost:3000/docs
```

All endpoints are documented with query parameters, descriptions, and example values so you can test directly from the browser.

## Matches API

```http
GET /matches?date=20180101&sport_id=1&lang=2&tz=07:00
```

Filter one match and return database-friendly rows:

```http
GET /matches?date=20180101&sport_id=1&lang=2&tz=07:00&match_id=g6763i4gwvvso7r
```

The response maps AiScore data into `league`, `homeTeam`, `awayTeam`, `event`, and `result` objects that line up with the current database tables. It also includes an `aiscoreRaw` field with the raw decoded AiScore protobuf payload for debugging.

The service calls:

```text
https://api.aiscore.com/v1/web/api/matches
```

Then it:

1. Reads the response as bytes.
2. Gunzips the body when it still has the gzip magic header.
3. Decodes it as `onescore.app.v1.Matches` with `protobufjs`.
4. Returns a compact JSON list of matches along with the decoded AiScore payload.

For debugging the decoded protobuf object:

```http
GET /matches?date=20180101&sport_id=1&lang=2&tz=07:00&raw=true
```

## Match Odds API

Crawl odds for a single match by ID:

```http
GET /matches/odds?match_id=g6763i4gwvvso7r
```

`match_id` is required — the endpoint returns `400` when it is omitted.

The response includes:

- `matchId` — the requested match ID.
- `odds` — snapshot odds (open, pre-match, half-time) derived from the timeline, suitable for database insertion.
- `oddsTimeline` — full chronological odds timeline for all markets (`hdc`, `ou`, `corner`).
- `aiscoreRaw` — the decoded AiScore protobuf payloads for each market (`asia`, `bs`, `corner`), or `null` when the market is unavailable for that match.

The service calls:

```text
https://api.aiscore.com/v1/web/api/match/odds/detail
```

with `odds_type=asia`, `odds_type=bs`, and `odds_type=corner` in parallel. All three markets are always attempted; missing markets appear as `null` in `aiscoreRaw` and contribute no entries to `odds`/`oddsTimeline`.

## AiScore Raw API

Open an AiScore public page via Playwright, capture the requested API response from browser network traffic, decode the protobuf body, and return the decoded JSON payload directly:

```http
GET /aiscore/raw?publicPageUrl=https%3A%2F%2Fwww.aiscore.com%2F20180101&apiUrl=https%3A%2F%2Fapi.aiscore.com%2Fv1%2Fweb%2Fapi%2Fmatches%3Flang%3D2%26sport_id%3D1%26date%3D20180101%26tz%3D07%253A00
```

`publicPageUrl` is required and must be a fully-qualified `https://www.aiscore.com/...` URL. `apiUrl` is required and must be a fully-qualified `https://api.aiscore.com/...` URL. Any other host or protocol returns `400`.

Response body is the full decoded protobuf JSON object from AiScore upstream (no wrapper metadata fields).

Typical AiScore API URLs to proxy:

```text
https://api.aiscore.com/v1/web/api/matches?lang=2&sport_id=1&date=20180101&tz=07%3A00
https://api.aiscore.com/v1/web/api/match/odds/detail?match_id=g6763i4gwvvso7r&odds_type=asia&cid=2
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
