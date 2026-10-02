# Farm Market Service Guidelines

## Scope

Java 25 Spring Boot 3.5 modular monolith for the "Kira Farm" multi-branch farm store. One package per capability under
`com.kira.farm` (`identity`, `branch`, `catalog`, `inventory`, `promotion`, `order`, `loyalty`, `account`,
`dashboard`), each split into `domain`, `application`, `infrastructure`, `web`. Cross-cutting code lives in `shared`.

## Change Rules

- Controllers stay thin; transactions live in application services; entities have no web concerns.
- All money is `BIGINT` VND (`long`); compute percentages with `BigDecimal` and an explicit `RoundingMode`.
- Stock changes only through `InventoryService` (`reserve`/`release`/`commit`/`receive`/`adjust`); every change is a
  single conditional `UPDATE` so overselling is impossible. `inventory_movements`, `order_status_history` and
  `loyalty_ledger` are append-only. Loyalty awards are idempotent via `UNIQUE(ref_type, ref_id, reason)`.
- Staff/manager data access goes through `BranchAccess`; never trust a branch id from the client without it.
- Errors: throw `ApiException(status, STABLE_CODE, "Vietnamese message")`; `GlobalExceptionHandler` adds the trace id.
  Never log tokens, passwords, phones, addresses, or payment payloads.
- Schema changes are new Flyway files in `src/main/resources/db/migration`; never edit an applied migration.
- Dev seed (users + demo catalogue) only when `APP_SEED_DEVELOPMENT_USERS=true`; branches/categories come from `V2`.
- Keep `/api/v1` stable; update `farm-market-ui` models when a contract changes. `OpenApiContractIT` compares `/v3/api-docs`
  with `src/test/resources/openapi-baseline.json`; only regenerate it (env `OPENAPI_REGEN=true`) for a deliberate change.
- Performance conventions: request threads are virtual (`spring.threads.virtual.enabled`); the Hikari pool is the
  concurrency limit, so never hold a connection across a slow call. No N+1: associations are LAZY (no `EAGER`), pages load
  related rows with one `IN` query (`default_batch_fetch_size`, `@EntityGraph`, or an explicit `findAllById`/projection
  such as `UserRepository.findNames`), aggregates are computed in SQL, and pure reads use `@Transactional(readOnly = true)`.
  When you add or change a list/read endpoint, add it to `QueryCountIT` with a bound that does not grow with page size.
  Add an index only with EXPLAIN evidence in `IndexExplainIT` (V1 already indexes most predicates).
- Pure money/eligibility rules live in small immutable classes with unit tests (`CheckoutPricing`, `PromotionRules`,
  `StockLevel`, `Money`); services orchestrate I/O around them. Native-query rows use interface/record projections, not `Object[]`.
- Public cache headers: only `PublicCacheFilter` sets `Cache-Control: public` (+ ETag) and only for anonymous GETs of
  branches, categories, the product list and one product, with a short `max-age` and `must-revalidate`. Never cache
  anything authenticated or `/admin`; errors are never cached. Keep new public endpoints out of the filter unless stale data is harmless.
- In-memory state (`LoginRateLimiter`) must be bounded: expire entries and cap the map; per-instance only (move to Redis for >1 replica).

## Verification

Run `./mvnw.cmd compile` from this directory using Java 25. Do not run tests, Flyway, packaging, containers or other
modules unless explicitly requested.

Integration tests (`*IT`, failsafe, Testcontainers `mysql:8.0`, needs Docker) run only on request via
`$env:TESTCONTAINERS_RYUK_DISABLED='true'; .\mvnw.cmd verify`. Unit tests stay DB-free (`.\mvnw.cmd test` skips `*IT`).
