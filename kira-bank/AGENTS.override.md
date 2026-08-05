# Kira Bank Integration Guidelines

## Scope

`kira-bank` is a two-part financial application: a Java 25 modular-monolith API in `kira-bank-service` and an Angular 22 client in `kira-bank-ui`. This file governs cross-module work plus `docs`, Compose, and synchronization scripts; the child modules have more specific overrides.

## Change Rules

- Keep credit-card and investment domains independent. Shared dashboard presentation must not create cross-domain foreign keys or hidden write coupling.
- For an API change, update backend DTO/controller behavior, frontend models/callers, and relevant docs together. Preserve `/api/v1` contracts unless the task explicitly introduces a versioned change.
- Treat financial amounts, ledger entries, payments, rewards, and settlement operations as integrity-sensitive. Avoid floating-point arithmetic and preserve auditability/idempotency.
- Add database changes through a new Flyway migration. Keep manual synchronization scripts dry-run by default and idempotent when `-Apply` is used.
- Use `.env.example` for configuration shape. Never commit or print real DB, JWT, R2, or AI credentials.
- Use Compose only when explicitly needed for runtime verification; do not rebuild the whole stack for a local code-only check.

## Verification

Verify only the affected child module according to its override. Cross-module changes also require static contract inspection on both sides. Do not run tests or full-stack builds unless explicitly requested.
