# kira-tool

Deploy: see [DEPLOY.md](DEPLOY.md).

Standalone rewrite of the Google Drive / Scribd to PDF tool. It replaces the legacy `kira-tool-service` and the
`/tool` page of `kira-ui`, which stay untouched (copy-only). This folder has its own git repository (`git init`,
no commits yet) and is not part of the monorepo index.

- `kira-tool-service`: Node.js >= 22.18 (TypeScript run directly via native type stripping, no build step), Express 5,
  patchright 1.64 (Playwright fork, used with its defaults), built-in `node:sqlite` file DB. Port `1407`, context path `/tool-service`.
- `kira-tool-ui`: Angular 22.2.1 standalone app with Signals, hash routing, same-origin API calls.

## How it works

`POST /jobs {url}` validates the link against an allowlist (https; `drive.google.com`, `scribd.com`, `www.scribd.com`,
`xx.scribd.com`; no userinfo, port or IP), stores a `tool_job` row and hands it to a bounded worker pool
(`TOOL_WORKERS`, queue of 20; a full queue returns `429 QUEUE_FULL`). Each job runs in its own patchright browser,
navigates only to a URL rebuilt from the document ID, and writes `{TOOL_STORAGE_DIR}/{jobId}.pdf` (temp file plus
atomic rename). The service never solves or evades captchas: a captcha / bot-challenge page (Google "unusual traffic",
reCAPTCHA, hCaptcha, Cloudflare "Just a moment") fails the job fast with `PROVIDER_BLOCKED`.

Lifecycle: `QUEUED -> RUNNING -> SUCCEEDED | FAILED | CANCELLED`; `SUCCEEDED -> EXPIRED` after `TOOL_RETENTION_DAYS`.
`FAILED` jobs can be retried up to 3 attempts. Jobs left `RUNNING` by a restart are re-queued (or failed with
`INTERRUPTED` after 3 attempts).

Public, no login. Each browser gets a random owner id in an HttpOnly cookie (`tool_owner`, 30 days) and only sees its
own jobs. Clearing cookies loses the job list. API under `/tool-service/api/v1` (CSRF required on mutations):
`POST /jobs`, `GET /jobs` (latest 50), `GET /jobs/{id}`,
`GET /jobs/{id}/file`, `POST /jobs/{id}/retry`, `DELETE /jobs/{id}`. Errors are RFC 9457 ProblemDetail with a stable `code`.

## Run locally

The service needs Node `>=22.18`; the UI (Angular CLI) needs Node `^22.22.3 || ^24.15.0 || >=26`.

```powershell
cd kira-tool-service
npm ci
npx patchright install chromium      # once per patchright version
cp .env.example .env                 # optional: every value has a default
$env:TOOL_COOKIE_SECURE = 'false'    # plain-http local dev only
npm start                            # node src/server.ts  (or: node --env-file=.env src/server.ts)
npm test                             # node:test, fake extractors, in-memory DB
npm run typecheck                    # tsc --noEmit

cd ../kira-tool-ui
npm ci
npm start              # http://localhost:4202, proxies /tool-service to :1407
```

patchright needs its Chromium once per patchright version: `npx patchright install chromium` (on a Linux server
`npx patchright install --with-deps chromium` also installs the system libraries and asks for sudo).

## Same-origin only (no CORS)

The browser must reach the UI and the API on the same origin. Dev uses `proxy.conf.js`. In production serve the built UI
and proxy `/tool-service/` from one nginx server. The existing nginx template already has the location:

```nginx
location /tool-service/ {
  proxy_pass http://kira_tool_service_upstream;
  # Overwrite, never append: per-IP rate limits trust this header from private proxies only.
  proxy_set_header X-Forwarded-For $remote_addr;
}
```

To switch to this service, repoint the upstream from the old `:1406` to `:1407` and serve `kira-tool-ui/dist` for the page.
Also set `client_max_body_size 8k;` for that location (the app checks `Content-Length` only). The existing nginx files were not changed.
The owner cookie is scoped to `Path=/tool-service`, so the UI must call the API through that prefix.

## Known limits (ponytail)

- Single instance: dedupe and rate limits are in memory / in-process. Move them to the DB or Redis before running more than one replica.
- Public: submits are rate limited per client IP (10/min); the 3-active-jobs cap is per owner cookie, so the bounded
  queue (`QUEUE_FULL`) is the global backstop. Set `TOOL_FORWARD_HEADERS=none` if the service is ever exposed without nginx.
- Studocu and the legacy test endpoint were intentionally not ported.
