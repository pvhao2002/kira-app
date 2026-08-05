# Kira Schema Guidelines

## Scope

This module owns shared JPA entities, enums, DTOs, and manually managed SQL scripts for the main Kira database.

## Change Rules

- Treat entity fields, enum persistence, constraints, indexes, and SQL scripts as one data contract. Inspect all repository/query consumers before renaming or changing types.
- Add schema evolution as a new, narrowly named script under `src/main/resources/database/migrate`; do not rewrite a migration that may already have been applied.
- Prefer idempotent migration guards where MySQL supports them, and document preconditions for operations that cannot be safely repeated.
- Preserve existing data when adding non-null columns, changing enums, or rebuilding indexes. Include an explicit backfill/default strategy.
- Keep operational scripts separate from migrations. Never place credentials or environment-specific database names in committed SQL.
- Avoid adding application workflows to this module; it should remain a schema and shared-model boundary.

## Verification

Run `./mvnw.cmd compile` from this directory after Java/entity changes. Do not execute migrations, tests, package builds, or database commands unless explicitly requested. SQL inspection alone is not proof that a migration succeeds on production-sized data.
