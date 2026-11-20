# MatchMind API

Base path: `/api/v1`. JSON only. Timestamps are ISO-8601 UTC instants (`2026-11-20T19:45:00Z`). Decimals such as odds,
lines and probabilities are JSON numbers backed by `BigDecimal`.

Interactive docs: `/swagger-ui.html` and `/v3/api-docs`, on the API port (8090) only. They are on in local runs and off
when `SWAGGER_ENABLED=false`, which is the compose default. The web container (8088) answers 404 for both paths.

## Authentication

| Caller | How | Scope |
|---|---|---|
| Dashboard users | `Authorization: Bearer <JWT>` from `POST /auth/login` | `/api/v1/**` except `/external/**` |
| AI agents (machine-to-machine) | `X-Api-Key: <EXTERNAL_API_KEY>` (one shared key) + `X-Provider: <code>` | `/api/v1/external/**` only |
| Anyone (connectivity test) | nothing | `GET /api/v1/external/ping` only |

Roles:
- `VIEWER` can call every `GET` except `/api-logs/**` (admin only), plus `/auth/**`.
- `ADMIN` can also call every `POST`, `PUT`, `PATCH` and `DELETE`.

A JWT carries the user's `token_version` and a token id (`jti`). Password change, password reset, disabling the user and
`POST /auth/logout-all` revoke every older token; `POST /auth/logout` revokes only the token that made the call. A token
lasts `JWT_TTL` (8 h); `POST /auth/refresh` swaps it for a new one at any time, but never past `JWT_MAX_SESSION` (24 h)
after the password sign-in. Event streams of a revoked session end at once.

A user flagged `mustChangePassword` can call only `GET /auth/me`, `POST /auth/change-password` and the two logouts; every
other call is `403 PASSWORD_CHANGE_REQUIRED` until the password is changed.

Passwords: 10–72 bytes, not the user name, not a repeated character or pattern, not a simple sequence (`1234567890`,
`abcdefghij`), not a common password (`400 WEAK_PASSWORD`, message in `fieldErrors`).

Client IPs (rate limits, API log): `X-Forwarded-For` is honoured only from `TRUSTED_PROXIES`; the web container's nginx
overwrites it with the TCP peer unless an operator trusts a specific front proxy (see README).

## Errors

Every error has the same shape:

```json
{ "timestamp": "2026-11-20T21:40:00Z", "status": 400, "code": "VALIDATION_ERROR", "message": "Prediction payload is invalid",
  "fieldErrors": { "odds[2].settlementBasis": "required for LIVE odds (FULL_MATCH or REMAINING_MATCH)" },
  "path": "/api/v1/external/predictions", "traceId": "4f1c..." }
```

Responses never contain stack traces, SQL or internal paths. Quote `traceId` when reporting a problem. The same shape
(UTF-8, with `traceId`, `path` and an empty `fieldErrors`) is used for 401 and 403 from the security layer and for the
API-key filter. `fieldErrors` messages name the limit or format (`must be at most 128 characters`, `must be an ISO-8601
instant with Z or an offset, e.g. 2026-12-05T20:00:00Z`), never Java types. A malformed id in a URL path is a
`404 NOT_FOUND` ("Prediction not found"), a malformed query parameter a `400 INVALID_PARAMETER` naming the expected type.
A wrong `Content-Type` is `415 UNSUPPORTED_MEDIA_TYPE` ("Content-Type must be application/json").

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `MALFORMED_REQUEST`, `UNKNOWN_FIELD` (callbacks reject unknown fields), `INVALID_FIELD_TYPE`, `INVALID_PARAMETER`, `INVALID_DATE_RANGE`, `INVALID_MARKET`, `INVALID_TYPE`, `INVALID_RESULT`, `INVALID_STATUS`, `INVALID_TIMEZONE`, `INVALID_GROUP`, `EXPORT_TOO_LARGE`, `BAD_CURRENT_PASSWORD`, `PASSWORD_UNCHANGED`, `WEAK_PASSWORD` |
| 401 | `UNAUTHORIZED`, `BAD_CREDENTIALS`, `INVALID_API_KEY` |
| 403 | `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED` |
| 404 | `NOT_FOUND` (bad id in path), `MATCH_NOT_FOUND`, `PREDICTION_NOT_FOUND`, `PICK_NOT_FOUND`, `MODEL_NOT_FOUND`, `PROMPT_NOT_FOUND`, `USER_NOT_FOUND`, `LOG_NOT_FOUND` |
| 409 | `EVENT_ID_REUSED`, `MATCH_ALREADY_FINAL`, `STALE_RESULT`, `PROMPT_VERSION_CONFLICT`, `CONCURRENT_UPDATE`, `DATA_CONFLICT`, `USERNAME_EXISTS`, `PROMPT_NAME_EXISTS`, `SELF_LOCKOUT` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `PICK_NOT_IN_MATCH` |
| 429 | `LOGIN_RATE_LIMITED` (login and change-password, `Retry-After`), `RATE_LIMITED` (too many rejected API keys from one IP, `Retry-After: 60`), `TOO_MANY_STREAMS` |
| 500 | `INTERNAL_ERROR` |

## Pagination, sorting and filters

List endpoints take `page` (0-based), `size` (default 20, max 200) and `sort=field,asc|desc`. Sort fields are
whitelisted per endpoint; an unknown field falls back to the default order. They return:

```json
{ "data": [ ... ], "meta": { "page": 0, "size": 20, "totalElements": 134, "totalPages": 7 } }
```

The dashboard, predictions and reports share these filters:

| Param | Meaning |
|---|---|
| `from`, `to` | Instants. `from` is inclusive, `to` is exclusive. They filter on `predicted_at` |
| `league` | Exact league |
| `modelId`, `providerId`, `matchId` | UUIDs |
| `type` | `PRE_MATCH` or `LIVE` |
| `market` | `1X2`, `AH`, `OU`, `CORNER_AH`, `CORNER_OU` (pick level) |
| `result` | Current settlement result of the pick, `PENDING` included |
| `search` | Case-insensitive match on teams, league or external match id |

---

## External callback APIs (X-Api-Key)

Every agent uses the same key (`EXTERNAL_API_KEY` in the server's `.env`) and names itself and its model in headers.
There is nothing to register first: an unknown provider or model is created on its first call.

| Header | Required | Rules |
|---|---|---|
| `X-Api-Key` | yes | The shared key. Missing or wrong: `401 INVALID_API_KEY` |
| `X-Provider` | yes | Who is calling, e.g. `openclaw`. Lower-cased, then `^[a-z0-9][a-z0-9_-]{1,63}$`. Missing: `400 PROVIDER_REQUIRED`; invalid: `400 INVALID_PROVIDER`. Matches and event ids are scoped per provider |
| `X-Model-Name` | predictions | The model, e.g. `gpt-5.1` (≤ 128 characters). Wins over `model` in the body |
| `X-Model-Version` | no | ≤ 64 characters, default `1` |

Anyone holding the key can write as any provider name, so treat it like a password and rotate it by changing
`EXTERNAL_API_KEY` and restarting the API.

Each call is audited in `external_api_requests` and shown on the API Logs page. Send an optional `X-Request-Id` header
(≤ 128 characters) to correlate retries. The body must be a JSON object of at most 1 MB. Unknown fields are rejected
with `UNKNOWN_FIELD`, so typos are not silently dropped.

Browser pages on any origin may call these endpoints: CORS answers `Access-Control-Allow-Origin: *` for `GET` and
`POST` with the headers above plus `Content-Type` and `X-Request-Id`, and never allows credentials. This is how the
MatchMind artifact sends the requests a sandboxed agent could not. The key stays a header, so a page only gets what it
already holds. The dashboard API keeps the exact origins in `CORS_ALLOWED_ORIGINS`.

### `GET /api/v1/external/ping` (public)

A connectivity test for integrators: no headers needed. The key is not checked, even when sent. Nothing is stored or
audited, so a ping does not appear on the API Logs page. Only `GET` is public; any other method on this path needs the
key.

```json
{ "status": "ok", "serverTime": "2026-11-19T13:05:00Z" }
```

### 1. `POST /api/v1/external/predictions`

Agents that cannot set custom headers (e.g. a ChatGPT Custom GPT Action, see [`chatgpt-action.yaml`](chatgpt-action.yaml))
may send `?provider=…&model=…&modelVersion=…` in the URL instead of `X-Provider` / `X-Model-Name` / `X-Model-Version`;
`X-Api-Key` stays a header. Agents without internet (chat code sandboxes) that can write to Google Sheets append the
request as one row of the sheet named in `MATCHMIND_SHEET_URL`. The Apps Script
[`google-sheet/MatchMind.gs`](google-sheet/MatchMind.gs) in that sheet sends new rows every 5 minutes. The sheet holds
the agent key, so keep it private and never share it by link: the link is in every prompt. Other agents
keep the request in the MatchMind artifact, a page in the chat built from the **MatchMind Artifact Prompt** (Prompt
Notes). The user sends it from the browser
with **Send** or **Send all** (see the CORS rule above). If the page cannot reach the server, **Copy JSON** copies the
request's header lines and body for **Import prediction**. Agents that cannot create artifacts reply `CANNOT_CALL_API`
with the JSON body, which an admin pastes into **Import prediction**: `POST /api/v1/predictions/import?provider=…&model=…&modelVersion=…`
(ADMIN JWT, body = the prediction JSON), with the same validation, audit log and live event as this endpoint.

Stores one immutable prediction snapshot, creates or updates the match, and returns the generated ids.
Full examples: [`samples/prediction-live.json`](samples/prediction-live.json) and
[`samples/prediction-pre-match.json`](samples/prediction-pre-match.json).

| Field | Required | Rules |
|---|---|---|
| `eventId` | no | `[A-Za-z0-9._:-]{1,128}`. Idempotency key per provider. Absent: derived from the payload hash, so resending the same JSON is a duplicate |
| `model.name`, `model.version` | no | Used only when `X-Model-Name` is absent. Neither present: `400 MODEL_REQUIRED` |
| `match.homeTeam`, `match.awayTeam` | yes | |
| `match.externalMatchId` | no | The match is upserted by `(provider, externalMatchId)`. Absent (screenshots): the provider's match with the same teams (case-insensitive) within 12 h of the kick-off is used, else a new match with a generated `auto-…` id |
| `match.league` | no | Absent: `Unknown league` for a new match; a known league is never overwritten |
| `match.startTime` | no | Absent: estimated as `predictedAt − matchMinute` (+15 min half-time after minute 45) for a new match; a known kick-off is never overwritten |
| `match.status` | no | `SCHEDULED` or `LIVE` only. Terminal statuses come from the results API |
| `predictionType` | yes | `PRE_MATCH` or `LIVE` |
| `predictedAt` | no | Instant. Absent: the time the server received the prediction |
| `matchMinute`, `currentScore` | LIVE only | Both required for LIVE. `currentCorners` is optional |
| `odds[]` | yes, 1–200 | See below |
| `picks[]` | yes, 1–20 | `{oddsRef, market, pick, probability 0..1, rank}`. `rank` is unique; `market` must equal the referenced odds' market; `pick` must fit the market |
| `correctScore` | yes | `{home, away, probability?}`. For LIVE it cannot be lower than the current score |
| `stats` | no | `possession` (0–100), `shots`, `shotsOnTarget`, `shotsOffTarget`, `corners`, `yellowCards`, `redCards` as `{home, away}`, plus `extra` |
| `simulation` | no | `method`, `simulationCount`, `randomSeed`, `expectedRemainingGoals`, `expectedRemainingCorners`, `algorithmVersion`, `parameters`, `probabilities`, `correctScoreDistribution` (array of `{home, away, probability}`) |
| `metadata` | no | Any JSON object |

Odds snapshot rules:
- `ref` is unique within the payload. `stage` is `OPENING`, `PRE_MATCH` or `LIVE`. LIVE odds are not allowed in a
  PRE_MATCH prediction.
- `1X2` takes `homeOdds`, `drawOdds` and `awayOdds`, and no `line`.
- `AH` and `CORNER_AH` take `line` (quoted for the **home** side, a multiple of 0.25), `homeOdds` and `awayOdds`.
- `OU` and `CORNER_OU` take `line` (≥ 0, a multiple of 0.25), `overOdds` and `underOdds`.
- Prices must be greater than 1. Prices that do not belong to the market are rejected.
- LIVE odds must state `settlementBasis`:
  - `FULL_MATCH` settles on the final result.
  - `REMAINING_MATCH` settles on the goals or corners scored **after** capture, so it requires `scoreAtCapture` (or
    `cornersAtCapture` for corner markets).

Responses:
- `201 Created` for a new prediction.
- `200 OK` with `"duplicate": true` when the same `eventId` is retried with an identical body (canonical JSON hash).
- `409 EVENT_ID_REUSED` when the same `eventId` arrives with a different body.
- `externalMatchId` in the response is the id to send results and settlement requests with.
- `409 MATCH_ALREADY_FINAL` when the match already has a FINISHED or CANCELLED result.
- `400` on `odds[i].settlementBasis` when a 1X2 odds entry uses `REMAINING_MATCH`: 1X2 is always settled on the full match.
- `429` from the proxy when one client IP sends more than about 10 callbacks per second (burst of 50).

```json
{ "predictionId": "…", "matchId": "…", "externalMatchId": "auto-…", "duplicate": false,
  "picks": [ { "pickId": "…", "rank": 1, "market": "AH", "pick": "HOME", "oddsId": "…" } ],
  "odds": { "ah-live": "…", "ou-live": "…" } }
```

### 2. `POST /api/v1/external/matches/results`

Inserts or updates the actual result of a match that already exists for this provider (`404 MATCH_NOT_FOUND` otherwise).
Example: [`samples/match-result.json`](samples/match-result.json).

| Field | Rules |
|---|---|
| `externalMatchId` | Required |
| `status` | `SCHEDULED`, `LIVE`, `FINISHED`, `CANCELLED`, `POSTPONED`. `FINISHED` requires `finalScore` |
| `finalScore`, `finalCorners`, `halfTimeScore`, `halfTimeCorners` | `{home, away}`. The half-time score cannot exceed the final score. If an update leaves out `finalCorners` or half-time data, the stored values are kept while the status allows them |
| `resultAt` | Required. A result older than the one already applied is rejected with `409 STALE_RESULT` |

Re-sending the same result is idempotent: it returns `"changed": false`. Each real change is appended to the match's
result history. When the status becomes `FINISHED` or `CANCELLED`, pending picks settle automatically. Already-settled
picks are not touched; an admin recalculates them explicitly.

```json
{ "matchId": "…", "status": "FINISHED", "changed": true,
  "settlement": { "matchId": "…", "matchStatus": "FINISHED", "settled": 3, "alreadySettled": 0, "pending": 0, "needsReview": 0,
                  "picks": [ { "pickId": "…", "market": "AH", "pick": "HOME", "result": "HALF_LOSS", "status": "SETTLED",
                               "reason": null, "aiResult": null, "aiAgrees": null } ] } }
```

### 3. `POST /api/v1/external/predictions/settle`

Asks the backend to settle the match's pending picks now. Example: [`samples/settle.json`](samples/settle.json).
Replace `pickId` with an id returned by the predictions API.

| Field | Rules |
|---|---|
| `externalMatchId` | Required |
| `aiCalculations[]` | Optional, ≤ 200 entries: `{pickId, result, explanation}`. Every `pickId` must belong to this match (`422 PICK_NOT_IN_MATCH`) |

The deterministic engine is authoritative. AI calculations are **advisory**:
- They are stored in the result's `details.aiCalculation`.
- They are compared in the response (`aiResult`, `aiAgrees`).
- They never change the stored result.
- For picks that were already settled, the AI claim is returned in the response and the audit log only.

If the match is not `FINISHED` or `CANCELLED`, picks stay pending (`pending` count) and nothing is written.
`needsReview` counts already-settled picks whose fresh calculation now differs from the stored result, for example
after a corrected score. An admin resolves them with recalculate or override; they are never changed silently.

### Settlement rules (engine `settle-v1`)

- **1X2:** WIN or LOSS on the final score.
- **AH:** the line is applied to the home margin, with the sign flipped for an AWAY pick.
  - Margin + line > 0 is WIN, < 0 is LOSS, = 0 is PUSH.
  - Quarter lines (±0.25, ±0.75, …) split the stake across the two neighbouring half-point lines. The outcomes are
    WIN, HALF_WIN, PUSH, HALF_LOSS and LOSS.
- **OU:** total goals compared with the line, with the same quarter-line split.
- **CORNER_AH and CORNER_OU:** same rules on corners. If final corners are missing, the pick stays pending (reason
  `CORNER_RESULT_MISSING`).
- **REMAINING_MATCH basis:** uses final minus at-capture goals or corners. A final below the capture score keeps the
  pick pending (`FINAL_BELOW_CAPTURE_SCORE`).
- **CANCELLED match:** VOID.
- **Any other non-final status:** PENDING, with no row written.
- **Win rate:** `(WIN + HALF_WIN) / (WIN + HALF_WIN + LOSS + HALF_LOSS)`.

---

## Dashboard APIs (JWT)

### Auth and users
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{username, password}` → `{accessToken, expiresAt, user}`. Only failures count: 5 per (username, client IP) lock that pair for 15 min, 30 per IP in 5 min block the IP (`429`, `Retry-After`). A stranger cannot lock `admin` out from another IP |
| POST | `/auth/logout` | any | 204. Ends this session only |
| POST | `/auth/logout-all` | any | 204. Ends every session of the user (all devices) |
| POST | `/auth/refresh` | any | → `{accessToken, expiresAt, user}`. New token (sliding); never later than 24 h after the password sign-in. The old token stays valid until it expires. Call it before `expiresAt`; a 401 means sign in again |
| GET | `/auth/me` | any | Current user (`mustChangePassword`) |
| POST | `/auth/change-password` | any | `{currentPassword, newPassword (10–72)}` → 204. Revokes all tokens and clears `mustChangePassword`. 5 wrong current passwords in 15 min give `429`; a new password equal to the current one is `400 PASSWORD_UNCHANGED` |
| GET | `/users` | admin | All users: `{id, username, role, status, lastLoginAt, createdAt, updatedAt, mustChangePassword, loginLocked}` |
| POST | `/users` | admin | `{username, password, role, mustChangePassword?}` |
| POST | `/users/generate-password` | admin | → `{password}`: 16 random characters that pass the policy. Nothing is stored; put it in the create or reset form and hand it over |
| PATCH | `/users/{id}` | admin | `{role?, status?}`. Admins cannot demote or disable themselves (`SELF_LOCKOUT`). Role and status changes are audited |
| POST | `/users/{id}/reset-password` | admin | `{newPassword, mustChangePassword?}` → 204 |
| POST | `/users/{id}/unlock` | admin | 204. Clears the failed-login lockout of the user on every IP |
| GET | `/users/audit` | admin | `userId?, page, size` → `{data:[{id, at, actor, targetId, target, action, oldValue, newValue, clientIp}], meta}`. Actions: `USER_CREATED`, `ROLE_CHANGED`, `STATUS_CHANGED`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `LOGIN_UNLOCKED` |

### Providers and AI models (read-only)
Both are created by external calls (`X-Provider`, `X-Model-Name`); there are no create or update endpoints.
- `GET /providers`: `{id, code, name, models, predictions, lastCallbackAt, createdAt}` for filters.
- `GET /models?providerId=`, `GET /models/{id}`: prediction count, settled, wins, losses, pending, win rate and the
  last prediction time.

### Matches and predictions
| Path | Notes |
|---|---|
| `GET /matches` | `search, status, league, providerId, from, to` (on start time). Sort: `startTime, league, homeTeam, awayTeam, status, predictionCount` |
| `GET /matches/leagues` | Distinct leagues |
| `GET /matches/{id}` | `{match, models[] (per-model summary + latest prediction), latestStats, resultHistory[]}` |
| `GET /predictions` | Shared filters. Sort: `predictedAt, league, model, type, minute, probability, startTime`. One row per prediction with its top-ranked pick |
| `GET /predictions/{id}` | Full record: match, model, odds snapshots, stats, simulation, picks with full settlement history, correct scores, metadata and the original **payload** |

### Settlement (admin)
| Path | Body | Notes |
|---|---|---|
| `POST /settlements/matches/{matchId}` | – | Settle pending picks now |
| `GET /settlements/needs-review` | — | Settled picks whose match result changed afterwards and would now settle differently (newest 500 checked) |
| `POST /settlements/picks/{pickId}/recalculate` | `{reason}` | Re-runs the engine and supersedes the current result. If the match is no longer FINISHED or CANCELLED, a settled pick goes back to `PENDING` (status `UNSETTLED`) |
| `POST /settlements/picks/{pickId}/override` | `{result, reason}` | Manual result and supersedes the current result |

### Dashboard and reports
| Path | Notes |
|---|---|
| `GET /dashboard?tz=Europe/London` | `totals`, `winRateOverTime` (daily, in `tz`), `predictionsByModel`, `predictionsByMarket`, `resultDistribution`, `modelPerformance` |
| `GET /reports/model-performance` | Per model: predictions, picks, settled, wins/half wins, losses/half losses, push/void, pending, win rate, average probability, correct-score evaluated, hits and accuracy |
| `GET /reports/breakdown?by=market\|league\|type\|stage\|model` | The same counters grouped by the chosen key |
| `GET /reports/prediction-history` | One row per pick, paginated. Sort: `predictedAt, league, model, market, probability, price, line, result, minute, type, homeTeam` |
| `GET /reports/prediction-history/export?format=csv\|xlsx` | Same filters and sort. At most 50 000 rows (`EXPORT_TOO_LARGE`). Cells starting with `= + - @` are neutralised |
| `GET /reports/market-performance` | All five markets, always listed |
| `GET /reports/model-comparison?minModels=2` | Paginated matches predicted by at least N models, with each model's latest prediction and top pick |
| `GET /reports/monte-carlo` | `{summary, page}`: simulation inputs and outputs next to actual outcomes |

### Prompt templates
`GET /prompts`, `GET /prompts/{id}`, `POST /prompts` `{name, templateType, content, description?}`,
`PUT /prompts/{id}` `{content, description, active, expectedVersion}`. A stale `expectedVersion` returns
`409 PROMPT_VERSION_CONFLICT`.
`GET /prompts/{id}/for-agent` (ADMIN only) returns `{content}` with `{{EXTERNAL_API_KEY}}` replaced by the shared
agent key and `{{MATCHMIND_SHEET_URL}}` by the `MATCHMIND_SHEET_URL` link (empty when unset); the web "Copy" button
uses it for admins. Stored prompts keep the placeholder, so the key never enters the
database, the prompt history or a viewer's screen.

### API logs (admin only)
VIEWER gets `403` on every `/api-logs` path; the web client hides the menu entry for viewers.
- `GET /api-logs`: filters `providerId, status, endpoint, httpStatus, search, from, to`. Sort:
  `receivedAt, durationMs, httpStatus, endpoint`. Rows carry `providerName` and `actor`.
- `GET /api-logs/endpoints`
- `GET /api-logs/{id}`: includes `providerName`, `actor` and the `processingResult` summary. Request bodies and keys are
  never logged.
- `actor` is the signed-in admin behind an import, settle, recalculate or override done from the dashboard (those
  calls leave a row too); it is `null` for agent calls.
- Calls with a missing or wrong API key are sampled: one row per client IP per minute, and `429 RATE_LIMITED` beyond 30
  per minute from one IP, so a flood cannot fill this table.

### Live events
`GET /events/predictions` (ADMIN or VIEWER, `Accept: text/event-stream`) is a Server-Sent Events stream. After each
new prediction is stored (not on a duplicate retry) it sends:

```
event:prediction
data:{"predictionId":"…","matchId":"…","homeTeam":"…","awayTeam":"…","model":"…","predictionType":"LIVE"}
```

A `:ping` comment every 25 s keeps proxies from closing an idle stream. The server ends a stream after 30 minutes (or
when its JWT expires, whichever is first) and the web client reconnects. A stream ends immediately when its session is
revoked (logout, `logout-all`, password change or reset, user disabled). One user may hold 5 streams (opening a sixth
closes the oldest) and the server 200 (`429 TOO_MANY_STREAMS`); a browser that falls behind is dropped. The web client
sends the JWT in the `Authorization` header (fetch, not `EventSource`), so the token never appears in a URL.

## curl quick start

```bash
API=http://localhost:8088/api/v1        # via the web container (or :8090 for the API directly)
curl -s $API/external/ping              # reachability check, no key needed
TOKEN=$(curl -s $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<password>"}' | jq -r .accessToken)

KEY=<EXTERNAL_API_KEY from .env>
AGENT=(-H "X-Api-Key: $KEY" -H 'X-Provider: goalnet-lab' -H 'Content-Type: application/json')

curl -s $API/external/predictions "${AGENT[@]}" -H 'X-Model-Name: GoalNet' -H 'X-Model-Version: 2.1' \
  -d @docs/samples/prediction-live.json
curl -s $API/external/matches/results "${AGENT[@]}" -d @docs/samples/match-result.json
```
