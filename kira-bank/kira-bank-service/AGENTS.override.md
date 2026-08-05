# Kira Bank Service Guidelines

## Scope

This Java 25 Spring Boot service is a modular monolith organized by business capability. Within a capability, preserve the `domain`, `application`, `infrastructure`, and `web` boundaries.

## Change Rules

- Keep controllers thin, transactions in application services, persistence in repositories, and entities free of web concerns.
- Use `BigDecimal` and explicit rounding for money. Preserve ownership checks, ledger append-only behavior, settlement idempotency, and atomic updates across related financial records.
- Treat Security/JWT, refresh tokens, attachment access, R2, and AI document processing as sensitive. Validate authorization server-side and never log secrets or private document contents.
- Keep API errors flowing through `GlobalExceptionHandler` with stable codes and trace IDs; do not leak SQL or stack traces.
- Add schema evolution as a new versioned file under `src/main/resources/db/migration`. Never edit an applied Flyway migration; keep data backfills deterministic.
- Keep external AI/storage providers behind their existing interfaces and configuration properties. A provider result must not directly persist financial data without validation.

## Verification

Run `./mvnw.cmd compile` from this directory after Java changes, using Java 25. Do not run tests, Flyway, package builds, containers, or other modules unless explicitly requested.
