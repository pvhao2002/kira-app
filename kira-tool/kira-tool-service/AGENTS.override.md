# Kira Tool Service Guidelines

## Scope

Public job API that renders Google Drive and Scribd documents to PDF. Node.js (>=22.18, runs TypeScript directly via
native type stripping, no build step), Express 5, patchright (Playwright fork) as the browser driver, built-in
`node:sqlite`. Not part of the monorepo build; lives in the `kira-tool` repository.

## Change Rules

- TypeScript must stay erasable: no enums, parameter properties or namespaces; `import type` for types; `.ts`
  extensions in relative imports. Never put raw U+2028/U+2029 characters in source (Node's type stripper chokes).
- Runtime dependencies are `express` and `patchright` only; everything else is the Node standard library.
- Every provider URL goes through `parseProviderUrl` (`src/provider.ts`); extractors navigate only to
  `job.canonicalUrl` (rebuilt from the ID). Keep the allowlist and the request guard (`allow`) in sync.
- Job state changes only through `canTransitionTo`/`transition` and `JobService`; use `JobRepository.cas` so
  concurrent changes cannot overwrite each other. `JobService` methods stay synchronous (no `await` inside).
- Files are addressed by job UUID only (`FileStore`). Never build a path or `Content-Disposition` from user or page input.
- One browser per job via `withPage` (persistent context on a fresh temp profile; closes page and context and deletes the profile in `finally`); loops in extractors need an
  iteration cap and `deadline.check()`.
- Never log URLs, tokens, cookies, document names or contents. Log job id, provider, status, error code, duration only.
- Errors are `ToolError(code)` rendered as RFC 9457 problem+json by the app error handler; no stack traces, SQL,
  paths or URLs in responses.
- Public, no login: jobs are scoped to the anonymous `tool_owner` cookie. No CORS; `X-Forwarded-For` is trusted
  only from loopback/private proxies (`TOOL_FORWARD_HEADERS=native`). No secrets in code. Config comes from `TOOL_*`
  environment variables (see `.env.example`).
- Schema changes (`src/schema.sql`) are additive only.
- Mark deliberate shortcuts with a `ponytail:` comment naming the limit and upgrade path.

## Verification

From this directory: `npm test` and `npm run typecheck`. Tests use an in-memory database and fake extractors/queues;
do not start real browsers or call third-party sites in tests.
