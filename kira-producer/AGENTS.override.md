# Kira Producer Guidelines

## Scope

This service schedules and publishes crawl, prediction, backfill, and settlement work to RabbitMQ. It is the producer-side contract partner of `kira-queue`.

## Change Rules

- Keep queue constants, routing, and message payloads compatible with consumers in `kira-queue`. Inspect both sides before changing a DTO or queue name.
- Keep scheduled jobs small and delegating. Put selection, deduplication, and enqueue logic in services rather than scheduler methods or controllers.
- Preserve backpressure checks and avoid publishing unbounded batches. A retry or overlapping schedule must not create uncontrolled duplicate work.
- Keep active prediction-version selection consistent across cache, backfill, live prediction, and settlement enqueue paths.
- Store environment-specific RabbitMQ, datasource, and schedule settings in configuration; never hard-code credentials or deployment endpoints.
- Log stable identifiers and counts instead of full messages or sensitive payloads.

## Verification

Run `./mvnw.cmd compile` from this directory after Java changes. Do not run tests, package builds, RabbitMQ, or unrelated services unless explicitly requested. Contract changes require a static compatibility check against the corresponding `kira-queue` consumer.
