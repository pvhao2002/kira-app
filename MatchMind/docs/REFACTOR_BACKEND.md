# Backend refactor log (matchmind-api)

Behavior-preserving: same API, SQL, idempotency and append-only rules. Verified with `mvn -B verify` (unit + Testcontainers ITs).

## Round 1

Survey: the 74 files already use records, text blocks, switch expressions, `getFirst()` and `Stream.toList()`. No sealed
hierarchy or pattern switch fits without invented types, so none was added. Virtual threads skipped: the Hikari pool
(10) is the bottleneck, not thread count. `SettlementEngine` untouched (VERSION stays `settle-v1`).

Changed
- Caching: `spring-boot-starter-cache` + Caffeine (new dependency), `shared/CacheConfig`. Transaction-aware manager, so an
  eviction inside a transaction runs after commit. Two caches, explicit size and TTL:
  - `providerIds` (code to id, max 1000, 1 h): `ProviderService.resolve` ran 1-2 queries on every external call and
    every admin import. Ids are immutable and providers are never deleted.
  - `leagues` (max 1, 2 min): `MatchQueryService.leagues` (`SELECT DISTINCT` for filter dropdowns). Evicted by
    `PredictionIngestionService.ingest`, the only writer of match leagues. TTL bounds any manual SQL edit.
- Not cached on purpose: provider/model lists and dashboard/report aggregates (counts change on every ingestion and
  settlement; stale numbers would be visible), settlement results, anything per user, prompts (admin-only, low traffic),
  model lookup in ingestion (a model created in a rolled-back transaction would poison the cache).
- Dedup: `ExternalDtos.Pair.apply(pair, homeSetter, awaySetter)` replaces nine copy-pasted `if (x != null)` blocks in
  `PredictionIngestionService` and the private copy in `MatchResultService`.
- Cleanup: inline fully qualified names turned into imports; `node.fields()` iterator loop to `properties().forEach`;
  `List.of(...).contains` status checks to named `Set` constants; sorted copy in `needsReview` via stream; unused imports
  removed in the prediction repositories and `ReportService`; method refs instead of trivial lambdas.
- Tests: `CachingIT` (provider id served from cache after a DB change; league list cached then evicted by a new
  prediction).

Impact check: GitNexus `impact` was ambiguous for the common names `resolve`/`leagues` (18 and 7 candidates); callers were
confirmed by text search instead: `resolve` is called only from `ApiKeyAuthenticationFilter` and
`PredictionImportController`; `leagues` only from `MatchController`.

Next candidates: split `PredictionIngestionService` (validation vs persistence, 500 lines); `ReportService` per-report
classes; consider a data-version key to make dashboard caching safe.

## Round 2

Changed
- `PredictionIngestionService` (475 to ~340 lines): the cross-field validation block moved unchanged into the new
  package-private, pure `PredictionValidator.validate` (no I/O, no Spring). The service keeps orchestration, match upsert
  and entity mapping. Same error codes and field keys.
- `ReportService`: magic numbers (comparison page cap 50, default/max `minModels` 2/20) and the zero-count column list
  became named constants. Per-report class split skipped on purpose: the seven reports share `PICKS_FROM`/`AGG`/`Filters`,
  and splitting would add files and a shared-SQL holder without removing duplication.
- Test: `PredictionValidatorTest` (valid payload, all problems reported together, final score below current score).

Verified: `mvn -B verify` BUILD SUCCESS (unit + 49 ITs). SettlementEngine untouched.

## Round 3

Changed
- `PredictionQueryService.detail`: pick-view and match-map construction extracted into private static `pickViews` and
  `matchView` (same output, shorter method).
- Swept `src/main` for unused imports and TODO/FIXME: none left. Caches reviewed: `providerIds` and `leagues` keep their
  TTL/size; nothing further is safe to cache (see Round 1). Little left in this lane.

Verified: `mvn -B verify` BUILD SUCCESS (49 ITs + unit tests). SettlementEngine untouched.
