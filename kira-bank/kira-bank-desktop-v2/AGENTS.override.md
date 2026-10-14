# Kira Bank Desktop v2 Guidelines

## Scope

Native Go desktop client (Fyne v2, Windows / macOS / Linux) that reimplements every `kira-bank-ui` screen with native
widgets and talks to `kira-bank-service` over `/api/v1` directly. It replaces the Tauri webview shell in
`../kira-bank-desktop` (kept unchanged). No HTML/WebView.

Layout: `main.go` bootstrap; `internal/api` (HTTP client, auth, uploads); `internal/i18n` (embedded en/vi.json);
`internal/format` (money/date); `internal/ui/kit` (shell + shared widgets, API documented in `kit/README.md`);
`internal/ui/pages/<feature>` (each exports `Pages(env) []kit.Page`), wired in `internal/ui/pages/registry.go`.

## Change Rules

- Auth uses `POST /api/v1/auth/mobile/{login,refresh,logout}` (refresh token in JSON body). Access token stays in
  memory; the rotating refresh token lives only in the OS keyring (memory fallback). Never log or persist tokens,
  passwords, vault secrets or vault unlock tokens.
- Only a 401 with code `UNAUTHORIZED` (or no code) triggers a refresh; domain 401s (`VAULT_LOCKED`, ...) must not.
- Money is `shopspring/decimal` end to end; `float64` only for drawing charts/meters.
- Network I/O off the UI goroutine; touch widgets only via `fyne.Do` or the kit helpers (`kit.Async`, `AsyncView`).
- Send the optimistic `version` on updates/deletes; keep Idempotency-Key on transaction create; travel saves must
  preserve unknown blob fields (`travel/extras.go`).
- New page: add a feature package and one import + one append line in `registry.go`; `registry_test.go` enforces
  unique IDs and existing i18n keys. Add new strings to both `internal/i18n/en.json` and `vi.json`.
- Do not change `kira-bank-ui`, `kira-bank-service` or the `/api/v1` contract from this module.
- `KIRA_BANK_URL` (see `.env.example`) is only the default server; never hard-code a real/prod URL.

## Verification

Needs Go 1.27+ and a C compiler for CGO (MinGW-w64 on Windows). From this directory:
`go build ./... && go vet ./... && go test ./...` (first CGO build of Fyne takes several minutes).
Manual QA only when authorized: `KIRA_BANK_URL=http://localhost:8080 go run .` with the service running.
