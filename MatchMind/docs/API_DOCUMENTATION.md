# MatchMind API

Base path: `/api/v1`. Requests use JSON except for multipart image uploads. Timestamps are ISO-8601 UTC instants (`2026-11-20T19:45:00Z`). Decimals such as odds,
lines and probabilities are JSON numbers backed by `BigDecimal`.

Interactive docs: `/swagger/index.html` (Swagger UI) and `/swagger/v3/api-docs` (OpenAPI JSON), on while
`SWAGGER_ENABLED=true` (the default). Through the web container they are for admins only: the **API Docs** sidebar item
sets the `mm_monitor` cookie (`POST /auth/monitor-session`, also scoped to `/swagger`) and nginx checks it on every
request, as for `/monitor/`. **Authorize** with a bearer token (or `X-Api-Key`) to use "Try it out".

## Parlays

Every signed-in user (ADMIN or VIEWER) keeps their own parlays; another user's parlay is `404`.

| Method and path | Input and result |
|---|---|
| `POST /parlays` | `{pickIds: [2..20 pick IDs], stake?: positive decimal}`. `201 {id}`. One pick per match: `400 SAME_MATCH`; a pick twice `400 DUPLICATE_PICK`; an unknown pick `404 PICK_NOT_FOUND`; a pick whose odds have no price `400 NO_PRICE`. |
| `GET /parlays?page=0&size=25` | Newest first. Each parlay: `id, createdAt, stake, legs[], totalOdds` (product of the leg prices), `result, payout, profit`. A leg: `pickId, predictionId, matchId, homeTeam, awayTeam, league, startTime, market, pick, line, lineDisplay, price, result`. |
| `DELETE /parlays/{id}` | `204`. |

`result` is worked out on every read from the legs' current pick results: any `LOSS` makes it `LOSS`; otherwise any
`PENDING` keeps it `PENDING`; otherwise each leg multiplies the return, `WIN` by its price, `HALF_WIN` by
(1 + price) / 2, `PUSH` and `VOID` by 1, `HALF_LOSS` by 0.5, and the parlay is `WIN` above 1, `PUSH` at 1, `LOSS` below.
`payout` = stake x that factor and `profit` = payout - stake, both `null` without a stake or while `PENDING`.

## Account Management

| Method and path | Input and result |
|---|---|
| `POST /account/imports` | Signed-in user, no body. `201 {importId, prompt}`: a new import owned by the caller and the prompt to paste, with the transaction screenshots attached, into an AI chat. The screenshots never reach the API. The AI writes all their transactions, overlaps listed once, into one `ACCOUNT` row. `503 ACCOUNT_IMPORT_UNAVAILABLE` while `MATCHMIND_SHEET_URL` is unset. |
| `POST /external/account/transactions` | The Sheet sender submits one import. The server resolves the owner from the import ID. See the [example request](samples/account-import.json). |
| `GET /account/transactions?page=0&size=25` | Returns `transactions`, pagination `meta` and `reports` for the signed-in user. Reports cover all pages. |

The existing spreadsheet gains an `ACCOUNT` tab when its owner installs the updated Apps Script and reruns `setup()`.
The agent appends one row per import, copies the import ID into `importId` and writes the JSON array into `transactions`.
It leaves `sync` and `syncedAt` blank for the minute trigger. Spreadsheet readers can see the submitted transactions.
For a scoped sender, issue the `sheet` provider a key with the `ACCOUNT_IMPORT` scope and save it in the
`MATCHMIND_ACCOUNT_KEY` Script Property. The script otherwise uses its existing `MATCHMIND_API_KEY`.
The signed-in account's cash profit is successful withdrawals minus successful deposits. Reports track rewards separately.
The `allTime` totals contain `deposits`, `withdrawals`, `rewards` and `profit`, plus `depositCount` and
`withdrawalCount` (successful rows) and `cancelledWithdrawalCount` and `cancelledWithdrawals` (cancelled withdrawal
rows and their amount, which stay out of `withdrawals` and `profit`). The `weekly` and `monthly` arrays use the same
totals with a `periodStart` date. Weeks begin on Monday and reporting dates use GMT+7. `weekly` and `monthly` are
newest first and omit periods without transactions. See the [example response](samples/account-transactions.json).

## Visitors

Signed-out visits for the admin **Visitors** page. The login page sends the public IP it got from
`https://api.ipify.org?format=json` once per browser session. The country comes from Cloudflare's `CF-IPCountry` header
(`XX` unknown, `T1` Tor), browser and OS from the `User-Agent`. The same IP and User-Agent within 30 minutes is one
visit. Rows are kept without expiry. See the [example responses](samples/visits.json).

| Endpoint | Behaviour |
| --- | --- |
| `POST /visits` | Public. Body `{"ip": "203.0.113.7"}`, `ip` optional (the API then uses `CF-Connecting-IP` or the peer). Any other field or a malformed IP is `400`. `204` always, also for a repeat within 30 minutes. nginx limits it to 6 per minute per visitor IP (`429`). |
| `GET /visits/countries` | ADMIN. `[{country, visits, uniqueIps, lastSeen}]`, most visits first. |
| `GET /visits?country=VN&page=0&size=100` | ADMIN. One page of visits, newest first: `{id, visitedAt, ip, country, browser, os, userAgent}`. `size` defaults to 100 (max 200). |

## Authentication

| Caller | How | Scope |
|---|---|---|
| Dashboard users | `Authorization: Bearer <JWT>` from `POST /auth/login` | `/api/v1/**` except `/external/**` |
| AI agents (machine-to-machine) | `X-Api-Key: mmk_<keyId>_<secret>` (per-provider key) | `/api/v1/external/**` only, limited by the key's scopes |
| AI agents, legacy (until 2026-12-31) | `X-Api-Key: <EXTERNAL_API_KEY>` (one shared key) + `X-Provider: <code>` | `/api/v1/external/**` only, all scopes |
| Anyone (connectivity test) | nothing | `GET /api/v1/external/ping` only |

Roles:
- `VIEWER` can call every `GET` except `/api-logs/**`, `/dashboard`, `/reports/**`, `/models/**`, `/providers/**`,
  `/prompts/**` and `/settlements/matches/{id}/prompt-input` (admin only), plus `/auth/**` and their own `/parlays`.
  Responses to a viewer never carry who made a prediction: the keys `model`, `models`, `modelId`, `modelName`,
  `modelKey`, `modelVersion`, `modelCount`, `provider`, `providerId` and `providerName` are removed at every depth, and
  the live `prediction` event has `model: null`.
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
| 400 | `VALIDATION_ERROR`, `MALFORMED_REQUEST`, `UNKNOWN_FIELD` (callbacks reject unknown fields), `INVALID_FIELD_TYPE`, `INVALID_PARAMETER`, `INVALID_DATE_RANGE` (`from` not before `to`; `fieldErrors.from` is set), `INVALID_RESULT_SCOPE`, `INVALID_MARKET`, `INVALID_TYPE`, `INVALID_RESULT`, `INVALID_STATUS`, `INVALID_TIMEZONE`, `INVALID_GROUP`, `EXPORT_TOO_LARGE`, `BAD_CURRENT_PASSWORD`, `PASSWORD_UNCHANGED`, `WEAK_PASSWORD`, `LEAGUE_ALIAS_SELF` |
| 401 | `UNAUTHORIZED`, `BAD_CREDENTIALS`, `INVALID_API_KEY` |
| 403 | `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED` |
| 404 | `NOT_FOUND` (bad id in path), `MATCH_NOT_FOUND`, `PREDICTION_NOT_FOUND`, `PICK_NOT_FOUND`, `MODEL_NOT_FOUND`, `PROMPT_NOT_FOUND`, `USER_NOT_FOUND`, `LOG_NOT_FOUND`, `LEAGUE_ALIAS_NOT_FOUND` |
| 409 | `EVENT_ID_REUSED`, `MATCH_ALREADY_FINAL`, `MATCH_MISMATCH`, `STALE_RESULT`, `MATCH_NOT_STARTED`, `MATCH_NOT_FINAL`, `PROMPT_VERSION_CONFLICT`, `CONCURRENT_UPDATE`, `DATA_CONFLICT`, `USERNAME_EXISTS`, `PROMPT_NAME_EXISTS`, `SELF_LOCKOUT`, `LEAGUE_ALIAS_CONFLICT`, `KEY_REVOKED` |
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
| `from`, `to` | Instants. `from` is inclusive, `to` is exclusive. They filter on `predicted_at`. Either may be sent alone (open range). `from` must be before `to` |
| `league` | Exact league name, ignoring surrounding spaces, case and accents (`liga nandu` = `Liga Ñandú`). [League aliases](#league-aliases) are resolved first, so an alias and its canonical name select the same matches |
| `modelId`, `providerId`, `matchId` | UUIDs |
| `type` | `PRE_MATCH` or `LIVE` |
| `market` | `1X2`, `AH`, `OU`, `CORNER_AH`, `CORNER_OU` (pick level) |
| `result` | Current settlement result of the pick, `PENDING` included |
| `search` | Substring of teams, league or external match id, ignoring case, accents and Unicode form (`atletico` finds `Atlético`, `munchen` finds `München`). No transliteration: `muenchen`/`munich` do not match |
| `includeArchived` | `true` also counts archived providers, models and matches. Default: archived rows are left out of every figure, list and dropdown. A model is hidden when it, its merge target or its provider is archived. Naming one explicitly shows only that one: `modelId` shows that archived model (its provider must not be archived, and its archived merged models stay hidden), `providerId` that archived provider, `matchId` that archived match. Archived matches stay out of aggregates even with `modelId` |
| `countPolicy` | `latest` (default) or `all`; anything else is `400 INVALID_COUNT_POLICY`. See *Counting policy* below |

**Model names.** Reports group on the *effective model*: a model merged into another (same provider) counts as its target,
and `modelId` = the target also covers the merged models. `modelName` is the display name (the admin's rename, else the
provider-supplied name); `modelKey` is always the provider-supplied name. Merged models are not deleted: they are only
hidden from model lists and dropdowns, and `includeArchived=true` shows them again.

**Counting policy (UX-046).** Agents often re-send a prediction under a new `eventId`; both rows are stored (idempotency
is unchanged). With `countPolicy=latest` (default) every **aggregate** counts only the latest prediction per
*(fixture, effective model, `predictionType`, `matchMinute`)*: the fixture is the match's fixture (the match itself while
unlinked), `matchMinute` compares exactly (`null` = `null` for `PRE_MATCH`), and the latest is the greatest
`(predictedAt, createdAt, id)`. The latest is chosen over **all** rows of that key and only then filtered, so a date
range never brings an older duplicate back. A prediction on an archived sibling match or of an archived merged model never
supersedes a visible one. `countPolicy=all` counts every row (the figures before this change).
- Follow the policy: dashboard totals, `predictionsToday`, charts and win rate; model performance, breakdown, market
  performance, calibration, model comparison and its coverage, Monte Carlo (summary and page); `GET /models` stats
  (units and ROI included); the per-model
  picks and results of `GET /matches/{id}`. `GET /models`, `GET /models/{id}` and `GET /matches/{id}` take
  `countPolicy` too (same values and `400 INVALID_COUNT_POLICY`).
- Lists show every row and mark it: `GET /predictions` and `GET /reports/prediction-history` rows carry
  `counted` (boolean), `GET /predictions/{id}` carries `counted` and `similar`. `predictionCount` of `GET /matches` and
  `models[].predictions` of `GET /matches/{id}` count every row.

---

## External callback APIs (X-Api-Key)

**Per-provider keys.** An admin creates the provider and issues its key on the Providers screen
(`POST /providers/{id}/keys`). The key is `mmk_<keyId>_<secret>`, shown once; the server keeps only the SHA-256 of the
secret. The provider comes from the key, so `X-Provider` is optional; when sent it must name the key's own provider. An
unknown model is still created by its first **accepted** prediction. Each key has scopes:

| Scope | Endpoint | Default |
|---|---|---|
| `PREDICTIONS` | `POST /external/predictions` | yes |
| `SETTLE_REQUEST` | `POST /external/predictions/settle` | yes |
| `RESULTS` | `POST /external/matches/results`, `GET /external/matches/unsettled` | no: an admin grants it to a trusted results feeder only |

**Legacy shared key.** While `EXTERNAL_API_KEY` is set (optional; planned cut-over 2026-12-31), that one key still works
for every provider with all scopes (a result it posts is not shared with other providers' matches, see
[results](#2-post-apiv1externalmatchesresults)): the agent names itself in `X-Provider`, and an unknown provider or model is created by
its first **accepted** prediction. A rejected request creates nothing; its API log row then has no provider. These calls
are marked `legacyKey: true` in API Logs. With `EXTERNAL_API_KEY` unset, the shared key gets `401` and the API still starts.

| Header | Required | Rules |
|---|---|---|
| `X-Api-Key` | yes | A per-provider key, or the legacy shared key. Missing, wrong or revoked: `401 INVALID_API_KEY` |
| `X-Provider` | legacy key only | Who is calling, e.g. `openclaw`. Lower-cased, then `^[a-z0-9][a-z0-9_-]{1,63}$`. Missing: `400 PROVIDER_REQUIRED`; invalid: `400 INVALID_PROVIDER`. With a per-provider key it is optional and must match the key's provider (`403 PROVIDER_MISMATCH`). Matches and event ids are scoped per provider |
| `X-Model-Name` | predictions | The model, e.g. `gpt-5.1` (≤ 128 characters). Wins over `model` in the body. Matched like `X-Provider`: spaces trimmed and collapsed, case ignored (`GPT-5.1` = `gpt-5.1`); the first spelling stored is the display name |
| `X-Model-Version` | no | ≤ 64 characters, default `1`. Trailing `.0` groups are ignored when matching (`1` = `1.0` = `1.00`) |

**Merged models.** If an admin merged the named model into another model of the same provider, a new prediction under the
old name is stored on the target (`ai_models.merged_into_id`), and no model row is created. Archived models, providers and
matches still accept callbacks; ingest never unarchives anything. After an unmerge the old name resolves to its own model
again; predictions stored in between are immutable snapshots and stay on the target. The response and the API log carry
ids only (no model name), so they already point at the stored prediction.

Other rejections: `403 PROVIDER_DISABLED` (an admin disabled the provider; checked on every request, never cached) and
`403 SCOPE_REQUIRED` (the key lacks the endpoint's scope). Every rejection is audited with the provider and key id when
known. A revoked key fails on its very next request. Rotate a per-provider key with
`POST /providers/{id}/keys/{keyRowId}/rotate` (both keys work until the old one is revoked). Anyone holding the legacy
shared key can write as any provider name; rotate it by changing `EXTERNAL_API_KEY` and restarting the API.

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
[`google-sheet/MatchMind.gs`](google-sheet/MatchMind.gs) in that sheet sends new rows every minute. The sheet holds
the agent key, so keep it private and never share it by link: the link is in every prompt. Agents that cannot write to the sheet reply `CANNOT_CALL_API`
with the JSON body, which an admin pastes into **Import prediction**: `POST /api/v1/predictions/import?provider=…&model=…&modelVersion=…`
(ADMIN JWT, body = the prediction JSON), with the same validation, audit log and live event as this endpoint.

Stores one immutable prediction snapshot, creates or updates the match, and returns the generated ids.
Full examples: [`samples/prediction-live.json`](samples/prediction-live.json) and
[`samples/prediction-pre-match.json`](samples/prediction-pre-match.json).

| Field | Required | Rules |
|---|---|---|
| `eventId` | no | `[A-Za-z0-9._:-]{1,128}`. Idempotency key per provider. Absent: derived from the payload hash, so resending the same JSON is a duplicate |
| `model.name`, `model.version` | no | Used only when `X-Model-Name` is absent. Neither present: `400 MODEL_REQUIRED` |
| `match.homeTeam`, `match.awayTeam` | yes | Stored NFC with whitespace, tabs, newlines and NBSP collapsed to one space and zero-width characters removed; blank after that is `400`. The two teams must differ |
| `match.externalMatchId` | no | The match is upserted by `(provider, externalMatchId)`. Absent (screenshots): the provider's match with the same teams within 12 h of the kick-off is used, else a new match with a generated `auto-…` id. Teams compare ignoring case, accents, punctuation, spacing and a trailing `FC`/`CF`/`SC`/`AFC`. A known `externalMatchId` sent with other teams (same comparison) is `409 MATCH_MISMATCH`; team names keep their first spelling |
| `match.league` | no | Absent: `Unknown league` for a new match; a known league is never overwritten |
| `match.startTime` | no | ISO-8601 string with `Z` or an offset, between `2000-01-01T00:00:00Z` and now + 2 years. Absent: estimated as `predictedAt − matchMinute` (+15 min half-time after minute 45) for a new match; a known kick-off is never overwritten by an estimate. A different explicit kick-off moves the match, is written to its result history, and reopens a `POSTPONED` match |
| `match.status` | no | `SCHEDULED` or `LIVE` only. Terminal statuses come from the results API |
| `predictionType` | yes | `PRE_MATCH` or `LIVE` |
| `predictedAt` | no | ISO-8601 string with `Z` or an offset, between `2000-01-01T00:00:00Z` and now + 5 minutes. Absent: the time the server received the prediction. A `PRE_MATCH` prediction must not be after the kick-off (sent or stored) |
| `matchMinute`, `currentScore` | LIVE only | Both required for LIVE. `currentCorners` is optional |
| `odds[]` | yes, 1–200 | See below |
| `picks[]` | yes, 1–2 | `{oddsRef, market, pick, probability 0..1, rank}`: the top two picks. `rank` is unique; `market` must equal the referenced odds' market; `pick` must fit the market. Two picks on the same market, stage, line and side are a `400` |
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
- `capturedAt` follows the `predictedAt` rule: ISO-8601 with an offset, from 2000 up to now + 5 minutes.
- LIVE odds must state `settlementBasis`:
  - `FULL_MATCH` settles on the final result.
  - `REMAINING_MATCH` settles on the goals or corners scored **after** capture, so it requires `scoreAtCapture` (or
    `cornersAtCapture` for corner markets).

Responses:
- `201 Created` for a new prediction.
- `200 OK` with `"duplicate": true` when the same `eventId` is retried with an identical body (canonical JSON hash).
  The hash compares instants as instants (`…20:00:00.000Z` = `…T03:00:00+07:00`) and text after whitespace cleaning.
- `409 EVENT_ID_REUSED` when the same `eventId` arrives with a different body.
- `possibleDuplicateOf`: the id of the earliest other prediction of the same effective model, fixture, type and minute
  with the same picks (typically an agent retry under a new `eventId`); `null` otherwise. On a `201` the new prediction
  is still stored, and reports count only the latest of such rows (see *Counting policy*). Also set on a `200`
  duplicate. Additive field: agents that ignore unknown fields are unaffected.
- `409 MATCH_MISMATCH` when `match.externalMatchId` already names a match between other teams; `fieldErrors` show
  the stored and sent names.
- `400 INVALID_FIELD_TYPE` for a number where a time is expected (epoch seconds or milliseconds are not accepted),
  `400 VALIDATION_ERROR` for a time outside its window, and for NUL characters, unpaired surrogates or Unicode
  direction controls (U+202A–U+202E, U+2066–U+2069) in any text of the payload.
- `externalMatchId` in the response is the id to send results and settlement requests with.
- `409 MATCH_ALREADY_FINAL` when the match already has a FINISHED or CANCELLED result, or when another member of the
  fixture it links to (the same game under another `externalMatchId`, any provider) has one. Nothing is stored.
- `400` on `odds[i].settlementBasis` when a 1X2 odds entry uses `REMAINING_MATCH`: 1X2 is always settled on the full match.
- `429` from the proxy when one client IP sends more than about 10 callbacks per second (burst of 50).

```json
{ "predictionId": "…", "matchId": "…", "externalMatchId": "auto-…", "duplicate": false, "possibleDuplicateOf": null,
  "picks": [ { "pickId": "…", "rank": 1, "market": "AH", "pick": "HOME", "oddsId": "…" } ],
  "odds": { "ah-live": "…", "ou-live": "…" } }
```

### 2. `POST /api/v1/external/matches/results`

Inserts or updates the actual result of a match that already exists for this provider (`404 MATCH_NOT_FOUND` otherwise).
Examples: [`samples/match-result.json`](samples/match-result.json),
[`samples/match-result-by-prediction.json`](samples/match-result-by-prediction.json).

| Field | Rules |
|---|---|
| `externalMatchId`, `matchId`, `predictionId` | Send exactly **one** (`400 VALIDATION_ERROR` otherwise). `matchId` and `predictionId` are the UUIDs of the prediction response; use them when the server generated the `externalMatchId` (`auto-…`). The match must belong to the caller's provider, except that a per-provider `RESULTS` key may post any provider's match by `matchId` alone |
| `status` | `SCHEDULED`, `LIVE`, `FINISHED`, `CANCELLED`, `POSTPONED`. `FINISHED` requires `finalScore` and a match whose `startTime` has passed (`409 MATCH_NOT_STARTED`) |
| `finalScore`, `finalCorners`, `halfTimeScore`, `halfTimeCorners` | `{home, away}`. The half-time score cannot exceed the final score. If an update leaves out `finalCorners` or half-time data, the stored values are kept while the status allows them |
| `resultAt` | Required. At most 5 minutes after the server time (`400 VALIDATION_ERROR`, field `resultAt`). A result older than the one already applied is rejected with `409 STALE_RESULT`; a stored `resultAt` that is itself more than 5 minutes ahead (accepted before this rule) never blocks a newer result |

Re-sending the same result is idempotent: it returns `"changed": false`. Each real change is appended to the match's
result history. When the status becomes `FINISHED` or `CANCELLED`, pending picks settle automatically. Already-settled
picks are not touched; an admin recalculates them explicitly.

**Shared across the fixture.** This endpoint needs the `RESULTS` scope. A per-provider key holding `RESULTS` is a
trusted source: its result is copied, in the same transaction, to every other match of the same
[fixture](#fixtures-cross-provider-match-identity) whose result differs (other providers' rows and same-provider
spelling variants), with one result-history row each (`newResult.propagatedFrom` = this match id) and settlement of
their pending picks. The legacy shared key may still post results for its own matches, but it is not a trusted source:
its result reaches only the caller's own match and its same-provider siblings, never other providers' members (they
keep their own result and the fixture shows `resultMismatch` once they differ). A member whose own result has a newer
`resultAt`, or whose kick-off is still ahead for `FINISHED`, keeps its result too. `propagatedTo` lists the members
that changed (`[]` when none).

```json
{ "matchId": "…", "status": "FINISHED", "changed": true, "propagatedTo": ["…"],
  "settlement": { "matchId": "…", "matchStatus": "FINISHED", "settled": 3, "alreadySettled": 0, "pending": 0, "needsReview": 0,
                  "picks": [ { "pickId": "…", "market": "AH", "pick": "HOME", "result": "HALF_LOSS", "status": "SETTLED",
                               "reason": null, "aiResult": null, "aiAgrees": null } ] } }
```

### 2b. `GET /api/v1/external/matches/unsettled`

Lists up to 500 matches of every provider that still have pending picks and kicked off more than 2 hours ago (not
archived, not `CANCELLED`), oldest first. Only a per-provider key with the `RESULTS` scope (`403 SCOPE_REQUIRED`
otherwise, the legacy shared key included). The Google Sheet script copies them into its `SETTLE` tab; an agent fills in
the results (prompt `AI_SHEET_SETTLEMENT`) and the script posts each filled row to `/external/matches/results` by
`matchId`.

```json
[ { "matchId": "…", "provider": "codex", "league": "…", "homeTeam": "Arsenal", "awayTeam": "Chelsea",
    "startTime": "2026-11-10T19:45:00Z", "status": "LIVE", "pendingPicks": 3 } ]
```

### 3. `POST /api/v1/external/predictions/settle`

Asks the backend to settle the match's pending picks now. Example: [`samples/settle.json`](samples/settle.json).
Replace `pickId` with an id returned by the predictions API.

| Field | Rules |
|---|---|
| `externalMatchId`, `matchId`, `predictionId` | Exactly one, as for match results |
| `aiCalculations[]` | Optional, ≤ 200 entries: `{pickId, result, explanation}`. Every `pickId` must belong to this match (`422 PICK_NOT_IN_MATCH`) |

The deterministic engine is authoritative. AI calculations are **advisory**:
- They are stored in the result's `details.aiCalculation`.
- They are compared in the response (`aiResult`, `aiAgrees`).
- They never change the stored result.
- For picks that were already settled, the AI claim is returned in the response and the audit log only.

If the match is not `FINISHED` or `CANCELLED`, picks stay pending (`pending` count) and nothing is written.
`needsReview` counts already-settled picks whose fresh calculation now differs from the stored result, for example
after a corrected score. An admin resolves them with recalculate or override; they are never changed silently.

### Settlement rules (engine `settle-v2`)

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
- **CANCELLED or POSTPONED match:** VOID. A postponed match that is later rescheduled keeps its old picks VOID (admin recalculate reopens one).
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
| POST | `/auth/monitor-session` | ADMIN | 204 + two `Set-Cookie: mm_monitor=<this token>; Path=/monitor` and `…; Path=/swagger` (HttpOnly; Secure; SameSite=Strict), valid until the token expires. Signs the browser in to Grafana at `/monitor/` and Swagger at `/swagger/` |
| GET | `/auth/sheet` | ADMIN | `{"url": "https://docs.google.com/…"}`: the shared Google Sheet (`MATCHMIND_SHEET_URL`) for the admin menu. 404 `SHEET_NOT_CONFIGURED` when unset or not https |
| GET | `/auth/monitor-check` | ADMIN | For nginx `auth_request` only. Reads the token from the `mm_monitor` cookie (the only path that accepts a cookie) → 204 + `X-Monitor-User: <username>`; 401 no/expired/revoked token, 403 not an admin |
| POST | `/auth/change-password` | any | `{currentPassword, newPassword (10–72)}` → 204. Revokes all tokens and clears `mustChangePassword`. 5 wrong current passwords in 15 min give `429`; a new password equal to the current one is `400 PASSWORD_UNCHANGED` |
| GET | `/users` | admin | All users by default. Filter with `?status=ACTIVE` or `?status=DISABLED`. Invalid values return `400 INVALID_STATUS`. Returns `{id, username, role, status, lastLoginAt, createdAt, updatedAt, mustChangePassword, loginLocked}` |
| POST | `/users` | admin | `{username, password, role, mustChangePassword?}` |
| POST | `/users/generate-password` | admin | → `{password}`: 16 random characters that pass the policy. Nothing is stored; put it in the create or reset form and hand it over |
| PATCH | `/users/{id}` | admin | `{role?, status?}`. Admins cannot demote or disable themselves (`SELF_LOCKOUT`). Role and status changes are audited |
| POST | `/users/{id}/reset-password` | admin | `{newPassword, mustChangePassword?}` → 204 |
| POST | `/users/{id}/unlock` | admin | 204. Clears the failed-login lockout of the user on every IP |
| GET | `/users/audit` | admin | `userId?, page, size` → `{data:[{id, at, actor, targetId, target, action, oldValue, newValue, clientIp}], meta}`. Actions: `USER_CREATED`, `ROLE_CHANGED`, `STATUS_CHANGED`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `LOGIN_UNLOCKED` |
| GET | `/activity` | admin, viewer | `username?, page, size` → `{data:[{id, at, username, method, path, status, clientIp, userAgent, browser, os}], meta}`, newest first. Every sign-in attempt (`POST /api/v1/auth/login`, any status) and every non-GET request of a signed-in user except `/auth/refresh`. A viewer always gets only their own rows (`username` ignored); an admin gets everyone or one user. `username` is null for a sign-in with an unknown username. Kept without expiry. |

### Providers and AI models
Providers are created by an admin (below); the legacy shared key still creates them from `X-Provider` until the
cut-over. Models are created by external calls (`X-Model-Name`).
- `GET /providers?includeArchived=`: `{id, code, name, description, status, disabledAt, disabledReason, activeKeys,
  models, predictions, lastCallbackAt, createdAt, archivedAt}`. Archived providers are hidden unless
  `includeArchived=true`; `models` counts the models in use (no merged or archived ones unless `includeArchived=true`).

Provider admin (ADMIN; viewers get 403, including on the key list). See [examples](samples/provider-keys.json).

| Method and path | Body and response |
|---|---|
| `POST /providers` | `{code, name, description?}`. 201 provider. `400 INVALID_PROVIDER` (code rule as `X-Provider`), `409 PROVIDER_EXISTS` |
| `PATCH /providers/{id}` | `{name?, description?, status?, reason?}`. `status` is `ACTIVE` or `DISABLED`; a status change needs `reason` (`400 REASON_REQUIRED`) and is logged (`DISABLE`/`ENABLE`). The code never changes. Returns the provider |
| `GET /providers/{id}/keys` | `[{id, keyId, label, scopes, status, createdAt, lastUsedAt, revokedAt}]`, newest first. Never the secret or its hash |
| `POST /providers/{id}/keys` | `{label?, scopes?}` (default `["PREDICTIONS","SETTLE_REQUEST"]`). 201 `{id, keyId, label, apiKey, scopes, createdAt}` with `Cache-Control: no-store`. `apiKey` is shown only here. `400 INVALID_SCOPES` |
| `POST /providers/{id}/keys/{keyRowId}/rotate` | `{label?}`. 201, a new key with the old key's scopes. The old key stays `ACTIVE` until revoked. `409 KEY_REVOKED` for a revoked key |
| `POST /providers/{id}/keys/{keyRowId}/revoke` | `{reason}`. 204; idempotent; logged (`KEY_REVOKE`). `404 KEY_NOT_FOUND` |
| `PUT /providers/{id}/keys/{keyRowId}/scopes` | `{scopes, reason}`. Returns the key; logged (`KEY_SCOPES`). `409 KEY_REVOKED` for a revoked key |

`POST /predictions/import` for a disabled provider is `403 PROVIDER_DISABLED`.
- `GET /models?providerId=&includeArchived=&countPolicy=`, `GET /models/{id}?countPolicy=`: `name` (provider-supplied key), `displayName` (the
  rename, else `name`), `archivedAt`, `mergedIntoId`, prediction count, settled, wins, losses, pending, win rate,
  `units`, `staked`, `roi` (see ROI below) and the last prediction time. The figures cover the model and every model merged into it, and, like the reports, leave out
  archived merged models and predictions on archived matches unless `includeArchived=true`. The list hides merged and
  archived models (and those of an archived provider, unless `providerId` names it) unless `includeArchived=true`.

### Archive, rename and merge (admin)

Every write requires an admin and a non-blank `reason` of at most 500 characters. Viewers receive 403.
Missing or blank reasons return `400 VALIDATION_ERROR`. Changes are recorded in the admin audit log.

| Method and path | Body and response |
|---|---|
| `POST /{providers,models,matches}/{id}/{archive,unarchive}` | `{reason}`. Returns the updated provider, model or match detail. `archivedAt` is a timestamp when archived and null when active. Use `includeArchived=true` on the corresponding list to show archived entries. |
| `PATCH /models/{id}` | `{displayName, reason}`. A blank `displayName` restores the provider-supplied name. The name can be at most 128 characters. Returns the updated model. |
| `POST /models/{id}/merge` | `{targetModelId, reason}`. Returns the source model with `mergedIntoId` set. Conflicts return `409 MODEL_MERGE_CROSS_PROVIDER` or `409 MODEL_ALREADY_MERGED`. |
| `POST /models/{id}/unmerge` | `{reason}`. Returns the model with `mergedIntoId` cleared. |

See [admin request examples](samples/admin-archive-merge.json).

### Fixtures (cross-provider match identity)

A fixture groups the `matches` rows of one real game: rows of different providers, and spelling variants of one
provider. Each provider still owns its match row; predictions and settlement never move.

- **Auto-link on ingest.** A new match joins the fixture whose normalised teams are equal and whose kick-off is within
  ±6 h (nearest first; the same league is only a tie-breaker, `Unknown league` still links), else a new fixture.
  Normalisation: lower case, accents and punctuation removed, one space, one club token (`fc cf sc afc ac`) dropped at
  the start and at the end; `W`, `U19`, `U21`, `II`, `B` stay. Home and away swapped do not link.
- **Results** are shared across members (see the results API). Merging never changes a result: members that disagree
  show `resultMismatch`.
- Every link change is stored in the append-only `fixture_link_history` (source `AUTO`, `ADMIN_MERGE`, `ADMIN_UNLINK`,
  `BACKFILL`; admin sources need a reason).

| Method and path | Body and response |
|---|---|
| `GET /fixtures/suggestions?page&size` | Pairs of different fixtures (an unlinked match is its own) within ±24 h whose normalised teams are equal (`reason: SAME_TEAMS`, `score: 1`) or similar by trigrams (`SIMILAR_NAMES`, `score` 0.5–1), best first. Row: `{a, b, reason, score}`; `a`/`b` = `{fixtureId, matchId, providerName, externalMatchId, league, homeTeam, awayTeam, startTime, status}` of the fixture's first member. A pair an admin separated with unlink is not suggested. Scans the latest 2000 fixtures |
| `POST /fixtures/merge` (admin) | `{matchIds: [uuid] (2–20 different), reason}`. Moves the listed matches and every sibling of their fixtures into the oldest of those fixtures. Returns the fixture view `{id, members, resultMismatch}`. `404 MATCH_NOT_FOUND` |
| `POST /fixtures/backfill` (admin) | One-off: links every match without a fixture, oldest first. Idempotent. Returns `{linked}` |
| `POST /matches/{id}/unlink` (admin) | See matches below |

See [fixture request examples](samples/fixtures.json).

### League aliases

Agents name leagues freely (`EPL`, `English Premier League`). An admin maps a variant name (alias) to a canonical name.
The `league` filter, `GET /matches/leagues` and `GET /reports/breakdown?by=league` then treat both as the canonical
league. Stored match rows keep the name the agent sent. Names compare like the league filter (trimmed, case-, accent-
and Unicode-form-insensitive). No chains: an alias cannot be a canonical name, and a canonical name cannot be an alias.
Every change is logged in `admin_actions` (entity `LEAGUE_ALIAS`, action `MERGE` when added, `UNMERGE` when removed).

| Method and path | Body and response |
|---|---|
| `GET /leagues/aliases` | `[{id, alias, canonical, createdAt}]`, ordered by canonical name |
| `POST /leagues/aliases` (admin) | `{alias (≤ 160), canonical (≤ 160), reason (≤ 500)}`. `201` with the alias. `400 LEAGUE_ALIAS_SELF` when both names are the same league; `409 LEAGUE_ALIAS_CONFLICT` when the alias already exists, the alias is a canonical name, or the canonical name is an alias |
| `POST /leagues/aliases/{id}/remove` (admin) | `{reason}`. `204`. `404 LEAGUE_ALIAS_NOT_FOUND` |

See [league alias examples](samples/league-aliases.json).

### Matches and predictions
| Path | Notes |
|---|---|
| `GET /matches` | `search, status, league, providerId, from, to` (on start time), `overdue=true` (only overdue), `includeArchived=true` (archived matches and those of an archived provider; naming `providerId` shows that provider's). Rows carry `overdue`: kick-off more than 3 h ago and still `SCHEDULED`/`LIVE`. Sort: `startTime, league, homeTeam, awayTeam, status, predictionCount` |
| `GET /matches/leagues` | Distinct canonical leagues of the visible matches (an alias is listed as its canonical name); `?includeArchived=true` adds those of archived matches |
| `GET /matches/{id}` | `{match, models[] (per-model summary + latest prediction), latestStats, resultHistory[], fixture}`. `match.fixtureId` (also on list rows) is the match's fixture or null. `fixture` is null or `{id, members[{matchId, providerId, providerName, externalMatchId, league, homeTeam, awayTeam, startTime, status, finalHomeScore, finalAwayScore, archivedAt}], resultMismatch}`; `resultMismatch` is true when non-archived `FINISHED` members have different final scores |
| `GET /predictions` | Shared filters plus `resultScope=TOP\|ANY` (default `TOP`): `result` matches the top-ranked pick, or any pick with `ANY` (with `market`, the same pick). `kickoffFrom`/`kickoffTo` (ISO instants, `kickoffTo` exclusive) bound the match kick-off time, where `from`/`to` bound the prediction time; a reversed pair is 400 `INVALID_DATE_RANGE`. Sort: `predictedAt, league, model, type, minute, probability, startTime`; `liveFirst=true` puts predictions of `LIVE` matches above the rest, each part in that sort order. One row per prediction with its top-ranked pick, `pickCount` and exclusive per-pick counts `pickWins, pickHalfWins, pickLosses, pickHalfLosses, pickPushOrVoid, pickPending`, and `counted` (false = superseded, left out of aggregates under `latest`). Every row is listed whatever `countPolicy` says |
| `POST /matches/{id}/result` (admin) | Enter or correct the result: `{status, finalScore?, finalCorners?, halfTimeScore?, halfTimeCorners?, reason? (≤ 2000)}`. Same field rules as the external results API, applied as of now: never `STALE_RESULT`, `FINISHED` allowed before `startTime`. A change is stored in the result history with source `ADMIN`, `changedBy` (the admin's id; the username and `reason` are in `newResult`). Returns `ResultResponse` like the external API; `FINISHED`/`CANCELLED` settles pending picks and `settlement.needsReview` counts settled picks that now differ. The result is copied to every other fixture member that differs (an admin result always wins), listed in `propagatedTo` |
| `POST /matches/{id}/unlink` (admin) | `{reason}`. Takes the match out of its fixture into a fresh fixture of its own (no-op when it is already alone). Returns the match detail |
| `GET /predictions/{id}` | Full record: match, model, odds snapshots, stats, simulation, picks with full settlement history, correct scores, metadata and the original **payload**. `counted`: whether reports count it under `latest`. `similar`: `[{predictionId, predictedAt, exact, counted}]`, the other predictions of the same counting key, oldest first (max 50); `exact` = same content apart from `eventId`, `predictedAt` and `metadata` |

### Settlement (admin)
| Path | Body | Notes |
|---|---|---|
| `POST /settlements/matches/{matchId}` | – | Settle pending picks now |
| `GET /settlements/needs-review?matchId=&predictionId=` | — | Settled picks whose match result changed afterwards and would now settle differently (newest 500 checked). Both filters are optional; the list length is the badge count for a match or prediction |
| `POST /settlements/matches/{matchId}/recalculate` | `{reason}` | Recalculates every pick of the match that `needs-review` lists, with one reason. Returns `PickSettlement[]` (empty when nothing needed review); `404 MATCH_NOT_FOUND` |
| `GET /settlements/matches/{matchId}/prompt-input` (admin only) | — | The match result and its picks with ids (**Copy settlement input**): `{matchId, externalMatchId, provider, league, homeTeam, awayTeam, startTime, status, finalScore, finalCorners, halfTimeScore, picks[{pickId, predictionId, market, pick, line, lineDisplay, oddsStage, settlementBasis, price, scoreAtCapture, cornersAtCapture, currentResult}]}`. Pairs are `{home, away}` or `null` |
| `POST /settlements/picks/{pickId}/recalculate` | `{reason}` | Re-runs the engine and always writes a new row that supersedes the current one, so the reason is recorded. Status `UNCHANGED` (same result), `SUPERSEDED`, `SETTLED` or, if the match is no longer FINISHED, CANCELLED or POSTPONED, `UNSETTLED` (back to `PENDING`). Status `PENDING`: nothing written, `reason` says why |
| `POST /settlements/picks/{pickId}/override` | `{result, reason}` | Manual result that supersedes the current one. Only for a FINISHED, CANCELLED or POSTPONED match (`409 MATCH_NOT_FINAL`). The same result again is `UNCHANGED` and writes nothing |

The `reason` of a `PickSettlement` returned by recalculate or override is the admin's reason. Rows written by an admin
store the admin's username in `details.actedBy`.

### Dashboard and reports
**ROI / units (UX-018).** Fixed stake of 1 per pick at the pick's stored price: `WIN` = price − 1, `HALF_WIN` =
(price − 1) / 2, `PUSH` = 0, `HALF_LOSS` = −0.5, `LOSS` = −1; `VOID` and pending are left out. `units` (scale 3) is the
sum, `staked` counts `WIN, HALF_WIN, PUSH, HALF_LOSS, LOSS` (PUSH in, VOID out), `roi = units / staked` (scale 4).
`units` and `roi` are null when `staked = 0`. They are on every aggregate row that has `winRate` and the counters
(dashboard `totals`, model performance, breakdown, market performance, `GET /models`); `winRateOverTime` rows carry the
day's `units`.

| Path | Notes |
|---|---|
| `GET /dashboard?tz=Europe/London` | `period`, `totals`, `winRateOverTime` (daily, in `tz`), `predictionsByModel`, `predictionsByMarket`, `resultDistribution` (one row per result, `PENDING` its own row), `modelPerformance`. `period` = `{from, to, basis: "predictedAt", firstPredictedAt, lastPredictedAt}`: the requested bounds (`null` = open) and the predictions actually counted. `totals.overdueMatches` uses only `league`/`providerId`, like `GET /matches?overdue=true`. `totals.notCountedPredictions`: predictions inside the filters left out by `countPolicy=latest` (0 under `all`) |
| `GET /reports/model-performance` | Per model: predictions, picks, settled, wins/half wins, losses/half losses, push/void, pending, win rate, average probability, correct-score evaluated, hits and accuracy, `notCountedPredictions` (as on the dashboard). `wins`/`losses` include the halves; `fullWins + halfWins + fullLosses + halfLosses + pushOrVoid = settled` is the exclusive split (also in breakdown, market performance and dashboard totals) |
| `GET /reports/breakdown?by=market\|league\|type\|stage\|model` | The same counters grouped by the chosen key; `league` groups by the canonical name (aliases resolved) |
| `GET /reports/top-pick?by=model\|market\|league\|type` | Like the breakdown, but only each prediction's top pick counts (the pick with the lowest `pick_rank`; its other picks are left out). Default `by=model`; any other `by` (including `stage`) is `400 INVALID_GROUP`. Same filters and `countPolicy`. `{total, rows}`: `total` has the counters of every top pick together, `rows` = `[{key, ...counters}]` ordered by picks desc, then `key`. Both include `winRate` and `roi`. Sample: [report-top-pick.json](samples/report-top-pick.json) |
| `GET /reports/type-comparison?by=model\|market\|league` | `PRE_MATCH` vs `LIVE` side by side (default `by=model`); the `type` filter is ignored, other filters and `countPolicy` apply. `[{key, preMatch, live, winRateDelta, roiDelta}]`: each side has the same counters as a breakdown row (without `key`), including `winRate` and `roi`. Delta = `LIVE` − `PRE_MATCH`; `null` when a side or a rate is missing. Ordered by total picks, then `key`. Sample: [report-type-comparison.json](samples/report-type-comparison.json) |
| `GET /reports/patterns?minSample=` | What winning and losing picks have in common. Every pick is counted once per factor it falls into; all filters and `countPolicy` apply. `{overall, minSample, rows: [{factor, value, …counters, winRate, roi, lift, z, signal}]}`. `overall` has the same counters as a breakdown row. Factors, in row order: `market`, `side` (market + pick), `type`, `stage` (odds stage), `league`, `model`, `rank` (`1`, `2`, `3+`), `probability` (`<40%`, `40-50%`, `50-60%`, `60-70%`, `70%+`), `price` (`1.65 or lower`, `1.66-1.80`, `1.81-1.90`, `1.91-2.05`, `above 2.05`, same bands as the prompt's track record), `line` (market + pick + line; odds without a line are skipped), `minute` (LIVE only: `0-15` … `76+`), `scoreState` (LIVE goal markets 1X2/AH/OU only: `Level`, `Pick side leading`, `Pick side trailing`, or `Not level` for OU/DRAW picks). Within a factor, rows are ordered by picks desc, then value. `lift` = `winRate` − overall `winRate`; `z` = `lift` / √(p₀(1−p₀)/n) with n = wins + losses (2 decimals); `signal` = `WARNING` (z ≤ −1.96) or `STRENGTH` (z ≥ 1.96) when n ≥ `minSample`, else `null` (tested on the unrounded z). Many overlapping groups are tested, so a flag is a lead to check, not proof. `lift`/`z`/`signal` are `null` when a rate is missing; `z` is also `null` when the overall win rate is 0 or 1. `minSample` defaults to 20 and is clamped to 1..1000. Sample: [report-patterns.json](samples/report-patterns.json) |
| `GET /reports/calibration` | `{bins: [{bin, from, to, picks, avgProbability, hitRate}] (always 10, width 0.1; probability 1 is in bin 10), evaluated, excluded}`. Every pick (all ranks). Only `WIN` (1) and `LOSS` (0) are evaluated; other settled results (halves, `PUSH`, `VOID`) are counted in `excluded`. Empty bins have `picks = 0` and null `avgProbability`/`hitRate`. Same filters and `countPolicy` as the win rate |
| `GET /reports/prediction-history` | One row per pick, paginated, every row whatever `countPolicy` says; `counted` marks picks of superseded predictions (false). `units`: the pick's profit at stake 1 (null when VOID or pending); also in the export, after `result`. Sort: `predictedAt, league, model, market, probability, price, line, result, minute, type, homeTeam` |
| `GET /reports/prediction-history/export?format=csv\|xlsx` | Same filters and sort. At most 50 000 rows (`EXPORT_TOO_LARGE`). Cells starting with `= + - @` are neutralised |
| `GET /reports/market-performance` | All five markets, always listed |
| `GET /reports/model-comparison?minModels=2` | Paginated **fixtures** predicted by at least N models, so models of different providers compare on one real game. Row: `fixtureId` (the match id while unlinked), `matchId` and the match fields of the first member with a matching prediction, `resultMismatch`, and `models[]` with each model's latest prediction and top pick; every entry carries its own `matchId` and `providerName` |
| `GET /reports/model-comparison/coverage` | Same filters. `[{minModels, matches}]` for 1..the largest model count (max 20), counted per fixture like the comparison rows; empty when nothing matches. Use it to default `minModels` to a value with data |
| `GET /reports/monte-carlo` | `{summary, page}`: simulation inputs and outputs next to actual outcomes. `summary.finishedPredictions` is the sample of the accuracy figures (`correctScoreHits / finishedPredictions`) |

### Prompt templates
`GET /prompts`, `GET /prompts/{id}`, `POST /prompts` `{name, templateType, content, description?}`,
`PUT /prompts/{id}` `{content, description, active, expectedVersion}`. A stale `expectedVersion` returns
`409 PROMPT_VERSION_CONFLICT`.
`content` is at most 200 000 characters and `description` 2000 (`400 VALIDATION_ERROR` with the limit in
`fieldErrors`).
`GET /prompts/{id}/for-agent` returns `{content, keyRendered}`, the text the web "Copy" button copies:
- `{{API_BASE_URL}}` becomes `PUBLIC_BASE_URL`, or when unset the origin of the request (`Host`, and
  `X-Forwarded-Proto` from nginx), e.g. `https://match.example.org`.
- `{{MATCHMIND_SHEET_URL}}` becomes the `MATCHMIND_SHEET_URL` link (empty when unset).
- `{{EXTERNAL_API_KEY}}` becomes the legacy shared agent key for ADMIN callers only, and only while `EXTERNAL_API_KEY`
  is set. `keyRendered` is `false` for viewers and when no shared key is configured: the placeholder is still in the
  text, so the UI must say so instead of reporting a ready-to-use copy. A per-provider key is put in by the browser
  only (Providers screen, "Copy prompt with this key" right after issuing it); it is never sent back to the API. That
  copy calls `GET /prompts/{id}/for-agent?sharedKey=false`, which always leaves the placeholder (`keyRendered: false`).
Stored prompts keep the placeholders, so the key never enters the database, the prompt history or a viewer's screen.

Prompt history: every saved version (API saves, restores and migrations that bump `version`) is kept append-only.
- `GET /prompts/{id}/versions`: newest first, `[{version, description, active, updatedBy, updatedByUsername, createdAt}]`
  without the text.
- `GET /prompts/{id}/versions/{version}`: the same plus `content` (`404 PROMPT_NOT_FOUND`).
- `POST /prompts/{id}/versions/{version}/restore` (admin) `{expectedVersion}`: saves that version's content and
  description again as a new version and returns the template. A stale `expectedVersion` is `409 PROMPT_VERSION_CONFLICT`.

Default templates: `AI_PREDICTION`, `AI_SETTLEMENT` and `AI_SHEET_SETTLEMENT` (filling in results in the sheet's `SETTLE` tab).

### API logs (admin only)
VIEWER gets `403` on every `/api-logs` path; the web client hides the menu entry for viewers.
- `GET /api-logs`: filters `providerId, status, endpoint, httpStatus, search, from, to`. `search` is a substring of the
  event id, request id or error message, ignoring case, accents and Unicode form (like the other searches). Sort:
  `receivedAt, durationMs, httpStatus, endpoint`. Rows carry `providerName`, `actor` and `legacyKey` (true for a call
  made with the legacy shared key: watch these reach zero before unsetting `EXTERNAL_API_KEY`).
- `GET /api-logs/endpoints`
- `GET /api-logs/{id}`: includes `providerName`, `apiKeyId`, `legacyKey`, `actor` and the `processingResult` summary. Request bodies and keys are
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
