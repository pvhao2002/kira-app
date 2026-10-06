# Farm Market Admin Desktop Guidelines

## Scope

Thin Tauri v2 shell (macOS / Linux / Windows) that opens the already-deployed `farm-market-ui` at `<FARM_ADMIN_URL>/admin`.
No admin UI code lives here; the page stays same-origin with `/api/v1`, so the HttpOnly `farm_refresh` cookie, CORS and
TOTP flow are unchanged. Bundling the Angular dist (tauri://localhost origin) is intentionally NOT done: it would need an
absolute API_BASE, a new CORS origin and a `SameSite=None; Secure` refresh cookie.

## Change Rules

- `FARM_ADMIN_URL` is a build-time env var (see `.env.example`); never hard-code a real/prod URL in the repo.
- Never add permissions, plugins, custom commands or a `remote` block in `src-tauri/capabilities/default.json`: the window loads remote content, so no IPC may be exposed to it.
- Keep the navigation lock in `main.rs`: only the admin origin is allowed; other http(s) links go to the system browser.
- Fallback page `dist/index.html` is shown only when `FARM_ADMIN_URL` is missing/invalid; keep its copy Vietnamese.
- Do not change `farm-market-ui`, `farm-market-service` or the API contract from this module.
- Signing/notarization is not set up; if added, secrets go in GitHub Secrets only.

## Verification

`npm install` then, in `src-tauri`, `cargo check` (compile only). Do not run `npm run build` (packaging) except in CI or when asked.
Manual QA only when authorized: `FARM_ADMIN_URL=http://localhost:4201 npm run dev` with service + UI running; check login (TOTP),
`/admin` render at 1440 px, reload keeps the session, external links open the system browser.
