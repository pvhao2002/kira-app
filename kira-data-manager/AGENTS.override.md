# Kira Data Manager Guidelines

## Scope

This module provides database-backed operational APIs for crawl dates, claims, failures, data issues, event history, leagues, teams, and recent team statistics. It can also request requeue work from `kira-producer`.

## Change Rules

- Keep controllers focused on HTTP validation and pagination. Put query composition in repositories and workflow logic in services.
- Use parameterized JDBC for every filter and mutation. Keep count queries and page queries semantically aligned, including ordering and zero-based page behavior.
- Treat most endpoints as operational/read APIs. Do not introduce writes unless the endpoint's purpose requires them, and make requeue operations explicit and bounded.
- Preserve response contracts consumed by `kira-ui` and gateway proxy endpoints. When a row/response shape changes, inspect those consumers in the same task.
- Keep datasource and producer endpoints configurable. Do not expose SQL, credentials, internal stack traces, or filesystem paths in responses or logs.

## Verification

Run `./mvnw.cmd compile` from this directory after Java changes. Do not run tests, package builds, database migrations, or other modules unless explicitly requested. For SQL changes, state clearly when correctness or performance was not verified against live data.
