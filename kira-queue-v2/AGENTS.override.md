# Kira Queue v2 Guidelines

## Scope

Standalone Node.js 22 (plain ESM JavaScript, no build step) port of `kira-queue`. Same behavior, same database writes:
four RabbitMQ consumers (`crawlByDate`, `event`, `prediction`, `prediction-settle` on `crawl_exchange`) and five HTTP
endpoints under `/queue` on port 2323 (`/ext/dates/{date}/matches`, `/ext/odds/candidates`, `/ext/events/{externalId}/odds`,
`/predict/events/{eventId}`, `/predict/url`). The only intended difference is the browser layer: Playwright (Java) is
replaced by `patchright` (npm, Chromium with Cloudflare-evasion patches). `kira-queue` (Java) is not touched and still runs.

Not ported on purpose: actuator endpoints, `AiscoreMatchPageReader`, `GatewayClaimClient`, `KiraCrawlClient`,
`BrowserPoolExhaustedException`, `RawEventAnalyst`, `QueueUtil`, `JsonUtil`, `CountryCodeShortUtil` / `EventHtml`
(dead code in v1), `BaseDataPredictionEngine` (dead in v1), `OddsMovementPredictionEngine` (never registered in v1). The deprecated codes `base_data` /
`odds_movement` resolve to no engine, exactly as in v1.
v1 has no `@Scheduled` job (the `app.odds-crawl-job.*` block, `SchedulerConfig` and `CrawlPersistExecutor` are unused),
so there is nothing scheduled to port.

Deploy wiring (`scripts/stack-*.yml`, nginx upstream, root `CLAUDE.md`) is intentionally NOT changed by this module.

## Change Rules

- Keep queue names, exchanges, routing keys, and message payloads compatible with `kira-producer`. Queues are declared
  durable with no extra arguments; adding arguments makes an existing queue fail with `PRECONDITION_FAILED`. Trace both
  publisher and consumer before changing a message contract.
- Keep the `/ext` HTTP contract compatible with `kira-crawl-extension/background.js` (bearer token, JSON bodies, JSON
  responses, 401 stops the run).
- Design consumers for redelivery: like v1, a message is acked after the handler settles (also when the handler caught a
  failure). Handlers run asynchronously off the AMQP receive callback; never put slow browser or DB work in that callback.
- Close browser pages/contexts on every path (`browser/lane.js` owns this) and respect the configured timeouts. Do not
  set `extraHTTPHeaders` or a user agent on the Patchright context, and keep `page.evaluate(script, arg, false)` (main
  world) so the `cf_clearance` cookie is sent by in-page `fetch()`.
- Keep prediction algorithms deterministic. When changing an engine, trace registry selection, stored prediction
  fields, and settlement behavior together. Money/price/line math uses `decimal.js` (or exact decimal strings), never
  floating point; ledger-style idempotency and ownership rules from the root `CLAUDE.md` still apply.
- Use parameterized SQL only (`db.js`, named placeholders). Never log SQL, parameters, tokens, passwords, cookies, or
  full third-party responses; HTTP errors return domain codes, never stack traces, SQL, or request payloads.
- Schema changes are additive migrations in `kira-schema`; this module does not own the schema.
- Secrets and configuration come from environment variables (`.env.example` is the shape reference).

## Verification

Run `npm ci && npm test` from this directory (`node --test`). The tests use fake pages, fake DB, and fake AMQP channels:
they do not start RabbitMQ, MySQL, a browser, or Docker. Runtime behavior against live Cloudflare/AiScore, a real MySQL
and a real broker is verified only by manual QA and must be reported as pending when not run.
