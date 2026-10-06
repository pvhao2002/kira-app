# Kira Bank Desktop Guidelines

## Scope

Thin Tauri v2 shell (macOS / Linux / Windows) that opens the already-deployed `kira-bank-ui` at `<KIRA_BANK_URL>/`
(the Angular root redirects to `/login`). No UI code lives here; the page stays same-origin with `/api/v1`, so the
HttpOnly `kira_refresh` cookie (sent with credentials), CORS, CSP and route guards are unchanged. Bundling the Angular
dist (tauri://localhost origin) is intentionally NOT done: it would break the relative `/api/v1` calls and the refresh
cookie, and would need a new CORS origin plus `SameSite=None`.

## Change Rules

- `KIRA_BANK_URL` is a build-time env var (see `.env.example`); never hard-code a real/prod URL in the repo.
- Never add permissions, plugins, custom commands or a `remote` block in `src-tauri/capabilities/default.json`: the window loads remote content, so no IPC may be exposed to it.
- Keep the navigation lock (`allowed` in `main.rs`): only the configured origin is allowed; other http(s) links go to the system browser.
- Fallback page `dist/index.html` is shown only when `KIRA_BANK_URL` is missing/invalid; keep its copy Vietnamese.
- Do not change `kira-bank-ui`, `kira-bank-service` or the `/api/v1` contract from this module.
- Signing/notarization is not set up; if added, secrets go in GitHub Secrets only.

## Verification

`npm install`, `npm test` (node:test config checks), then, in `src-tauri`, `cargo check`, then `KIRA_BANK_URL=https://bank.example.vn cargo test` (needs MSVC on Windows; without it, `cargo +stable-x86_64-pc-windows-gnu` with MinGW and `CARGO_TARGET_DIR=target/gnu` works for check/test).
Do not run `npm run build` (packaging) except in CI or when asked.
Manual QA only when authorized: `KIRA_BANK_URL=http://localhost:4200 npm run dev` with service + UI running; check login,
refresh survives reload, `/app` renders at 1440 px, travel map iframe works, external links open the system browser,
unset URL shows the fallback page.
