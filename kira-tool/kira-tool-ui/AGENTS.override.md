# Kira Tool UI Guidelines

## Scope

Angular 22.2.1 standalone client for `kira-tool-service`: the public PDF export job list (no login). Signals, OnPush, hash routing, strict TypeScript.

## Change Rules

- API calls go through `core/api/jobs.api.ts` and relative `/tool-service/api/v1` URLs (same origin, no CORS). The session is an HttpOnly cookie; never store tokens in JS or browser storage.
- CSRF uses cookie `TOOL-XSRF-TOKEN` and header `X-TOOL-XSRF-TOKEN` (configured in `app.config.ts`); keep it in sync with the backend `SecurityConfig`.
- `features/jobs/url-detect.ts` only mirrors the server allowlist for instant feedback; the server stays authoritative.
- Error codes map to user text in `features/jobs/error-messages.ts`; add a mapping whenever the backend adds a code.
- Keep accessibility: labelled inputs, error summary with `role="alert"`, `role="progressbar"` with `aria-valuenow`, `aria-live` announcements, visible focus, light/dark, reduced motion.
- Polling runs only while a job is queued or running and the tab is visible; clear it on destroy.

## Verification

Node `^22.22.3 || ^24.15.0 || >=26` is required. Run `npm ci`, then `npx ng test --watch=false` (focused specs under `src/app`).
Do not run a build, lint or dev server unless asked; a green test run is not proof of rendered UI behavior.
