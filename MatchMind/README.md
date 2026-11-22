# MatchMind

**AI Football Intelligence Platform.** External AI systems send football predictions (pre-match and live) through
secured callback APIs. MatchMind stores every snapshot unchanged and settles each pick against the real result with a
deterministic engine. It then shows how every AI model performs across matches, markets and leagues.

| Module | Stack |
|---|---|
| [`matchmind-api`](matchmind-api) | Java 25, Spring Boot 3.5, Spring Security, JPA/JDBC, Flyway, PostgreSQL 17 |
| [`matchmind-web`](matchmind-web) | Angular 22, native HTML + in-house kit, Chart.js, PrimeIcons |
| [`docker-compose.yml`](docker-compose.yml) | PostgreSQL + API + web (nginx), with health checks |

Documentation:
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API_DOCUMENTATION.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [Sample payloads](docs/samples)

## Run with Docker

```bash
cd MatchMind
cp .env.example .env      # replace every CHANGE_ME (DB password, JWT secret ≥ 32 bytes, first admin)
docker compose up -d --build
```

- The web UI is at http://localhost:8088.
- The web port is bound to `127.0.0.1` and serves plain HTTP. To reach it from other machines, put a TLS reverse
  proxy (for example Caddy or nginx with a certificate) in front of it. Never publish port 8088 directly: logins,
  JWTs and the agent API key would cross the network unencrypted.
- The API is at http://localhost:8090, bound to localhost only. Swagger (`/swagger-ui.html`, `/v3/api-docs`) exists only on
  this port and only when `SWAGGER_ENABLED=true`; the web container answers 404 for those paths.
- PostgreSQL is at localhost:5433.

### Client IP behind a reverse proxy

nginx in the web container never trusts a client-supplied `X-Forwarded-For`: it forwards its own TCP peer as the client
IP, so rate limits and the API log cannot be spoofed. Behind a TLS reverse proxy that peer is the proxy, so every user
would share one IP. To get real client IPs, mount a file that names **only that proxy's exact IP** (as the web container
sees it, for example the Docker network gateway) into `/etc/nginx/real-ip.d/`:

```
# real-ip.conf
set_real_ip_from 172.18.0.1;
real_ip_header X-Forwarded-For;
```

```yaml
# docker-compose override for the web service
volumes:
  - ./real-ip.conf:/etc/nginx/real-ip.d/real-ip.conf:ro
```

Never use a range such as `172.16.0.0/12` or `192.168.0.0/16`: it makes every LAN machine a trusted proxy. Check it:
`curl -s -X POST localhost:8088/api/v1/external/predictions -H "X-Forwarded-For: 203.0.113.77" -H "X-Api-Key: x" -d '{}'`
must log the real peer, not `203.0.113.77`. The API itself trusts `X-Forwarded-For` only from `TRUSTED_PROXIES`
(default `172.16.0.0/12`, the Docker network nginx sits on, in compose).

### Security headers and compression

One owner per path: for `/api/*` the API sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` and
`Referrer-Policy`; for the SPA and static files nginx sets them. nginx adds `Strict-Transport-Security` (to both) only
when the request carries `X-Forwarded-Proto: https`, so local HTTP runs never send HSTS. Make your TLS proxy set that
header. nginx gzips JS, CSS, JSON and SVG, except `/api/v1/auth/*` (credentials) and the event stream.

The first start creates the admin from `MATCHMIND_ADMIN_USERNAME` / `MATCHMIND_ADMIN_PASSWORD`, only while there are no
users. There is no public sign-up: the admin creates other users in **Settings**.

## Connect an AI provider

1. As an admin, open **Providers**, create the provider (e.g. `openclaw`) and issue it a key. The key
   (`mmk_<keyId>_<secret>`) is shown once; give it to that agent only. Each provider has its own keys, so one leaked key
   can be revoked (or rotated) without touching the other agents. Only an admin creates providers.
2. Each key has scopes. New keys get `PREDICTIONS` and `SETTLE_REQUEST`. Grant `RESULTS` (on the Providers screen) only
   to a trusted results feeder: a result from a `RESULTS` key is copied to the same game's matches of every provider.
3. The agent calls the three callback APIs with header `X-Api-Key` and, for predictions, `X-Model-Name` (+ optional
   `X-Model-Version`). The provider comes from the key; a new model is created by its first accepted prediction:
   - `POST /api/v1/external/predictions` (`PREDICTIONS`) sends a prediction snapshot. It is idempotent per `eventId`.
   - `POST /api/v1/external/matches/results` (`RESULTS`) sends the final score and corners. FINISHED or CANCELLED
     settles pending picks automatically.
   - `POST /api/v1/external/predictions/settle` (`SETTLE_REQUEST`) asks for settlement and may include advisory AI
     calculations.

**Legacy shared key (until 2026-12-31).** While `EXTERNAL_API_KEY` is set in `.env`, that one key still works for every
agent with all scopes: the agent sends `X-Provider` (who it is), and an unknown provider is created by its first
accepted prediction. Its results apply to that provider's own matches only, never to other providers'. These calls are
marked "legacy key" in API Logs: move every agent to its own key, wait for that count to reach zero, then unset
`EXTERNAL_API_KEY` (planned 2026-12-31).

See [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for every field and rule, plus a curl walkthrough using
[`docs/samples`](docs/samples). Every call appears on the **API Logs** page, except `GET /api/v1/external/ping`: a
public reachability check that needs no key and stores nothing.

The **Prompt Notes** page holds the "AI Football Prediction Prompt" and "AI Settlement Calculation Prompt" that
providers should use. Edits are versioned. When an agent's sandbox cannot reach the API, the prompts tell it to:
1. Append the request as a row of your Google Sheet, if it can write to Google Sheets (e.g. Meta AI). Set the sheet up
   once with [`docs/google-sheet/MatchMind.gs`](docs/google-sheet/MatchMind.gs) and put its link in
   `MATCHMIND_SHEET_URL`: the admin **Copy** fills it in, and the script sends new rows every minute. Keep the sheet
   private: anyone who can edit it can read the API key. Agents write to it through their Google account connection,
   signed in as you. Never share it by link: the link is in every prompt you paste into a chat.
2. Otherwise keep the request in a "MatchMind" artifact built from the "MatchMind Artifact Prompt" (give that prompt to
   the agent in the same conversation). You send the requests from the browser with **Send** or **Send all**. The
   artifact holds the API key, so do not publish or share it.
3. Only if neither works, reply `CANNOT_CALL_API` with the JSON body for **Import prediction**.

## Develop locally

```bash
# database only
docker compose up -d db

# API (http://localhost:8090, Swagger at /swagger-ui.html)
cd matchmind-api
export DB_PASSWORD=... JWT_SECRET=... MATCHMIND_ADMIN_USERNAME=admin MATCHMIND_ADMIN_PASSWORD=...
mvn spring-boot:run

# Web (http://localhost:4200, proxies /api to :8090)
cd matchmind-web
npm ci
npm start
```

Angular CLI 22 needs a recent Node. 22.20 is rejected; development used Node 26.0.0.

## Tests

| Suite | Command | What it covers |
|---|---|---|
| API unit + integration | `cd matchmind-api && mvn -B verify` | 58 settlement-engine cases. Testcontainers ITs on real PostgreSQL: auth and revocation, callbacks (idempotency, validation, cross-provider isolation, stale results, settlement), reports. Needs Docker |
| Web unit/component | `cd matchmind-web && npx ng test --watch=false` | Formatting and filters, API service params, auth/interceptor flow, login form, prompt edit/save/conflict/copy |
| End-to-end | `cd matchmind-web && npx playwright install chromium && npm run e2e:stack && npx playwright test` (own stack on `:8188`, see `docker-compose.e2e.yml`; set `E2E_BASE_URL`, `E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD`, `E2E_EXTERNAL_API_KEY` for another stack) | Real stack: login, provider and key onboarding, callbacks to settlement, prediction drill-down, report export, prompt editing, viewer permissions |

The e2e suite creates uniquely named data on each run, so it can be repeated against the same database. It signs in through
the UI once and reuses that session, so it stays well under the login rate limit (20 attempts per IP per 5 minutes).

## Configuration

All configuration comes from environment variables; see [`.env.example`](.env.example). Never commit `.env`.

| Variable | Purpose |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL connection |
| `JWT_SECRET`, `JWT_TTL` | Token signing secret (≥ 32 bytes) and lifetime (ISO-8601, default `PT8H`) |
| `MATCHMIND_ADMIN_USERNAME`, `MATCHMIND_ADMIN_PASSWORD` | First admin. Used only while the users table is empty |
| `MATCHMIND_SHEET_URL` | Optional Google Sheet that agents append unsent requests to. The admin copy of the prompts names it |
| `CORS_ALLOWED_ORIGINS` | Extra browser origins for direct dashboard API calls. `/api/v1/external/**` accepts any origin |
| `TRUSTED_PROXIES` | CIDRs whose `X-Forwarded-For` is trusted |
| `LOGIN_MAX_ATTEMPTS_PER_IP`, `LOGIN_MAX_FAILURES_PER_USER` | Login rate limits (defaults 20 per 5 min and 5 per 15 min) |
| `SWAGGER_ENABLED` | Swagger UI and OpenAPI JSON |
