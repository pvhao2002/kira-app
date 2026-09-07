# Kira Life Health

The health module is independent of financial and tutoring domains. Web routes are `/app/health/overview`, `/profile`, `/plans`, `/journal`, `/connection` (all under `/app/health`). Existing product routes, database names, Java packages and Docker image names are unchanged.

## Ownership, storage and versions

All `/api/v1/health` requests require a bearer access token. The authenticated principal supplies the owner; callers never supply `userId`. Admin role does not bypass ownership. Unauthenticated health requests return 401 so the companion can refresh.

New migration: `V23__create_health_module.sql`. It creates private profiles, dated weight measurements, versioned plans, versioned journals, the active device connection, daily HealthKit snapshots and AI job records. No previously applied migration is modified. Profile/plan/journal documents have typed validated DTOs stored in JSON columns; owner, date, status and version remain relational and indexed.

Create profile/plan/journal with `version: -1`. Update using the version returned by the last read. A stale write returns `409 HEALTH_VERSION_CONFLICT`. Plan approval serializes by owner and archives the previous active plan for that week atomically. Completion only toggles a plan item and increments its version; it never creates a meal or workout journal record. Dated weights are explicit upserts by owner/date.

## APIs

All paths below are relative to `/api/v1/health`.

| Method | Path | Request / response |
|---|---|---|
| GET / PUT | `/profile` | Read `{data, version}` or empty body when absent; write `{data: Profile, version}` |
| GET / PUT | `/weights` | List `{date, kg}` descending / upsert one measurement |
| DELETE | `/weights/{date}` | Delete this user's dated measurement |
| GET | `/summary?date=YYYY-MM-DD` | BMI, energy estimates, actual intake, HealthKit totals and workouts |
| GET | `/statistics?from=…&to=…` | Daily summaries; inclusive range, at most 91 days |
| GET | `/plans?weekStart=…` | All drafts, active and archived plans for a Monday-based week |
| POST / PUT | `/plans`, `/plans/{id}` | `{weekStart, data: {title, items, warnings}, version}`; edits apply to drafts only |
| POST | `/plans/{id}/approve` | `{version, restrictionsReviewed: true}` |
| PUT | `/plans/{id}/items/{index}/completion?version=…&completed=true` | Toggle an active plan item; zero-based index |
| GET | `/journals?from=…&to=…` | Actual entries, inclusive range capped at 91 days |
| POST / PUT | `/journals`, `/journals/{id}` | `{date, data: {kind, title, calories, minutes, notes}, version}` |
| DELETE | `/journals/{id}?version=…` | Delete an owned journal record with version check |
| GET / POST | `/connection` | Read active device or empty body; connect `{deviceId: UUID, timezone}` |
| DELETE | `/connection?deleteData=false` | Disconnect; `true` also deletes all synced daily data |
| POST | `/sync` | See synchronization protocol below |
| GET / POST | `/ai-jobs` | Latest 20 job records / generate from `{weekStart, fromDate, language: "en" or "vi", consent: true}` |

Profile data fields:

```json
{
  "heightCm": 170,
  "birthDate": "1990-01-01",
  "formulaSex": "MALE",
  "goal": "MAINTAIN",
  "timezone": "Asia/Ho_Chi_Minh",
  "activityFactor": 1.2,
  "calorieAdjustment": 0,
  "foodPreferences": "",
  "allergies": "",
  "avoidedFoods": "",
  "preparationMinutes": 30,
  "exerciseExperience": "",
  "equipment": "",
  "availability": "",
  "movementRestrictions": ""
}
```

Adults aged 20–120 only. Height: 80–250 cm, weight: 20–500 kg, activity factor: 1.2–2.4. The adjustment is an explicitly user-selected integer in −1000…1000 kcal, default 0; these are input limits, not recommended calorie prescriptions. LOSE permits nonpositive adjustments, MAINTAIN requires zero, GAIN permits nonnegative adjustments. Measurements before age 20 and future actual measurements/journal entries are rejected. Use IANA timezone identifiers. No pediatric, pregnancy or clinical treatment planning is implemented.

Each plan item is `{date, kind, title, portion, calories, minutes, notes, completed}`. `kind` is MEAL, WORKOUT or REST; REST has zero calories/minutes. Maximum 100 items, dates within the selected week. Journals allow MEAL or WORKOUT only. Calorie fields are nonnegative; planned meal values are estimates. Named exclusions are comma/semicolon/newline separated. Exact normalized term matching rejects conflicts; semantic safety is not guaranteed by text matching, so explicit user review remains mandatory.

## Energy semantics

- BMI = kg / (cm / 100)², using the latest weight on or before the requested date.
- Mifflin–St Jeor resting estimate = `10 × kg + 6.25 × cm − 5 × age + constant`; constant is +5 for MALE and −161 for FEMALE. This is estimated resting expenditure, not a measurement. [Original research](https://ajcn.nutrition.org/article/S0002-9165%2823%2916698-6/fulltext)
- With an active-energy reading, provisional food target = resting estimate + synced active energy + chosen adjustment.
- Without that reading, target = resting estimate × activity factor + chosen adjustment. Source is `PROFILE_ESTIMATE`; an observed zero is different from missing data.
- Actual intake sums MEAL journal calories only. Manual workout journal values do not contribute to Apple Health totals.
- Recorded total burn = recorded resting energy + recorded active energy, only when both exist. Workouts are displayed separately and never added again.
- Net = intake − recorded total burn. Missing inputs yield null, displayed as `—`. Invalid/nonpositive estimated targets are withheld, not silently clamped to a suggested minimum.
- Targets remain labeled provisional: HealthKit does not certify complete daily wear/coverage. A partial morning reading can produce a low provisional target; AI plans use the full-day profile reference instead. Neither new Watch data nor a target change mutates an approved meal plan.
- Historical summaries use the current profile and dated weight history. They are recalculated estimates, not immutable historical prescriptions.

## AI workflow

`POST /ai-jobs` records RUNNING, calls the configured provider, validates the draft, performs a separate structured restriction review and returns READY with `planId`, or FAILED with a stable `errorCode`. Generation runs within this request, outside a database transaction; job status survives an HTTP/proxy timeout and is visible on refresh. There is one running generation per user. Interrupted jobs older than ten minutes are failed before admitting another request. No financial AI queue records are reused.

The request must explicitly consent. Provider input contains goal, baseline calorie reference, chosen adjustment and dietary/exercise preferences/restrictions. It excludes identity, birth date, precise measurements and raw Watch data. Account priority and failover use the existing Cloudflare account policy. Provider response bodies/exceptions are not exposed to logs or clients. Failed or incompatible results do not create an applicable plan. Manual plans remain available without configured AI.

AI only generates dates from `fromDate` to the week's Sunday, today or later. Earlier entries from the active plan are copied into the draft; current/future entries are replaced only after approval. The profile version is checked again before the draft is saved. A changed profile aborts generation. Ingredient/medical suitability still requires human review; automated restriction checks are not medical certification.

## Mobile authentication

`POST /api/v1/auth/mobile/login` accepts the existing `{email,password}` shape and returns `{accessToken, expiresInSeconds, user, refreshToken}`. `/refresh` and `/logout` accept `{refreshToken}`. These are separate JSON endpoints; existing browser cookie endpoints are preserved. Refresh rotation locks the token row; reuse revokes the family and that revocation commits. Inactive/deleted accounts cannot refresh. Logout revokes the submitted refresh token.

The companion stores the session in device-only Keychain, never UserDefaults. An expired access token receives 401 and causes one refresh/retry. Invalid refresh credentials clear the local session. Network failures retain credentials for retry. Logout only reports success after server revocation; it stops observers and clears local sync state. HealthKit data is not sent to a redirect at a different origin.

## Synchronization protocol

Connect returns `{deviceId, generation, timezone, lastRevision, lastSyncedAt}`. There is one connection per user. Reconnecting the same device is idempotent. A different device requires explicit disconnect. New connections clear old daily snapshots to avoid mixing devices/timezones. Changing the profile timezone while connected is rejected; changing it after disconnect also clears old daily snapshots. Profiles, weights, plans and journals are unaffected.

```json
{
  "deviceId": "11111111-1111-1111-1111-111111111111",
  "generation": "22222222-2222-2222-2222-222222222222",
  "revision": 1,
  "timezone": "Asia/Ho_Chi_Minh",
  "days": [{
    "date": "2026-09-07",
    "activeCalories": 350,
    "restingCalories": null,
    "steps": 6000,
    "workouts": [],
    "source": "APPLE_HEALTH"
  }]
}
```

The server atomically replaces each supplied daily snapshot; missing days are not deleted. Null/omitted metrics overwrite old readings with unknown. An empty workout list removes previously synced workouts for that day. Each workout includes UUID `id`, UTC ISO `start`/`end`, display `type`, optional `calories`, and source app name. Workout date is its start in the health timezone. At most 31 unique dates and 300 workouts/day per request. Days cannot be future dates.

Revisions advance by exactly one; older/equal revisions are acknowledged without writing. Device and generation must match before accepting even a replay. A connection removed from the web cannot be silently recreated by background sync. The companion reads the current revision before retrying uncertain deliveries, re-aggregates pending dates, and clears them only after acknowledgment.

The companion initially covers 30 days. Anchored queries track additions/deletions and persist UUID-to-date mappings. Changed dates are re-aggregated using HealthKit daily cumulative statistics rather than summing workouts or source applications manually. Workout edits/deletions replace that day's list. Anchors, mappings and pending dates are saved atomically before network upload; partial successful batches retain remaining dates. Local progress files are protected and excluded from backup. Yesterday/today are reconciled on every sync even without anchor changes.

HealthKit doesn't expose read-denial status: empty data is not interpreted as denial or measured zero. Background delivery is best effort, gated by iOS, device lock state and available network. [Apple anchored queries](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery), [observer delivery](https://developer.apple.com/documentation/healthkit/executing-observer-queries).

## Rollout and acceptance

Deploy the API with V23 before enabling the web module or installing the companion. Use the existing backup/release procedure; no migration has been executed by this implementation session. The companion requires a reachable HTTPS origin with a trusted certificate. Allow enough proxy time for the two provider calls if using synchronous generation; after a timeout, refresh job status instead of assuming failure. No new provider credentials or fallback paths are introduced.

Validation performed: Java 25 backend compilation and static source/template/translation/project-file inspection only. No tests, Flyway execution, browser QA, Angular build, iOS build, signing, install or HealthKit device run were performed.

Device/runtime acceptance cases still to execute:

1. Known height/weight/age formula examples, goal signs, missing weights, measured zero versus missing calories, and partial-day targets.
2. Independent user A/B reads and mutations; stale profile/plan/journal writes; plan approval archives only the same user's matching week.
3. Completion does not create intake; manual workouts and imported workouts do not inflate active energy; total remains null when one component is absent.
4. First 30-day sync; repeated request; network lost before/after server commit; two sequential batches; restart during pending upload.
5. Add/edit/delete historical samples and workouts; multiple HealthKit sources; midnight/DST boundaries; profile timezone change requires disconnect and clears incompatible snapshots.
6. Permission declined/revoked/partial; no Watch readings; locked phone; delayed background delivery; foreground retry.
7. Expired access token, rotating refresh token, concurrent refresh/replay, logout and server-side disconnect during sync.
8. Missing AI configuration, provider failure, malformed draft, explicit restriction conflict, profile changed during generation, human review and regeneration of remaining dates.
9. Vietnamese/English labels, dark/light contrast, mobile-width layout, keyboard use and loading/empty/error states in all five routes.
