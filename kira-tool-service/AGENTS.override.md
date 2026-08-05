# Kira Tool Service Guidelines

## Scope

This service exposes focused utilities for Google Drive, Scribd, Studocu, PDF processing, and Playwright-assisted extraction.

## Change Rules

- Keep controllers limited to validation and response mapping; isolate browser, document, and provider-specific behavior in utility/service classes.
- Validate URLs, identifiers, filenames, and output paths before use. Prevent path traversal, arbitrary local-file access, and unsafe remote schemes.
- Close browser objects, streams, and temporary resources on every success or failure path. Keep downloads bounded with explicit timeouts and size limits where supported.
- Treat external page markup as unstable. Prefer resilient selectors and return actionable provider errors without exposing stack traces or full remote documents.
- Never log cookies, access tokens, private Drive links, document contents, or local absolute paths.
- Do not grow `TestController` into a production API; new production behavior needs a purpose-specific endpoint.

## Verification

Run `./mvnw.cmd compile` from this directory after Java changes. Do not access third-party sites, start Playwright, run tests, or package the service unless explicitly requested.
