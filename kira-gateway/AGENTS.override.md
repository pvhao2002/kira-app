# Kira Gateway Guidelines

## Scope

This module is the authenticated HTTP entry point for the main Kira application. It owns security, user administration, finance and dashboard APIs, travel checklists, crawl callbacks, and orchestration calls to producer, data-manager, crawl, and Gemini services.

## Change Rules

- Keep controllers thin. Put authorization and business decisions in services, persistence in repositories, and external-service setup in config/client classes.
- Preserve public API paths, request/response shapes, pagination semantics, and HTTP status codes unless the task explicitly changes the contract. Update the matching Angular or mobile consumer when a contract changes.
- Treat authentication, role checks, password resets, JWT signing, CORS, and internal endpoints as security-sensitive. Never log tokens, passwords, secrets, receipt contents, or full financial payloads.
- Use parameterized JDBC and the existing repository helpers. Preserve transaction boundaries and return domain-specific `BusinessException` errors instead of exposing database details.
- Keep downstream URLs, credentials, timeouts, and feature settings configurable through `application.yml` and environment variables.

## Verification

Run `./mvnw.cmd compile` from this directory after Java changes. Do not run tests, package builds, or other modules unless explicitly requested. For API changes, also inspect all in-repository callers even when runtime verification is unavailable.
