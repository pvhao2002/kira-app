# Deployment

Two containers plus MySQL 8:

| Part | Build | Port |
|---|---|---|
| `kira-affilate-service` | `docker build -t kira-affilate-service kira-affilate-service` | 8082 |
| `kira-affilate-ui` | `npm ci && npx ng build` → serve `dist/` as static files | 80/443 |
| MySQL 8 (utf8mb4) | managed or container | 3306 |

Serve the UI and proxy `/api/` to the service **on the same origin** (the refresh cookie is `SameSite=Strict`,
path `/api/v1/auth`). Terminate TLS at the proxy.

## Required environment (service)
| Variable | Notes |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Flyway creates the schema on first start |
| `JWT_SECRET` | ≥ 32 random chars; the service will not start without it |
| `SHOPEE_CREDENTIAL_ENCRYPTION_KEY` | Base64 of 32 random bytes. **Back it up**: without it stored Shopee secrets cannot be decrypted |
| `REFRESH_COOKIE_SECURE=true` | always in production |
| `CORS_ALLOWED_ORIGINS` | exact UI origin(s) |
| `TRUSTED_PROXIES` | CIDR of the reverse proxy, so login rate limiting sees real client IPs |
| `SHOPEE_SYNC_CRON`, `SHOPEE_SYNC_WINDOW_DAYS` | optional; default hourly at :15, 30-day rolling window |

`API_DOCS_ENABLED` stays `false` in production.

## Production checklist
- [ ] HTTPS only; HSTS is already sent by the service.
- [ ] One service instance. The sync in-flight guard and Shopee query pacing are in-memory (`shortcut:` in
      `SyncService`); running two instances needs a DB lock first.
- [ ] Database backups; MySQL not reachable from the internet.
- [ ] `ShopeeLiveIT` has passed with a real AppID/Secret (see `docs/shopee-api.md`).
- [ ] Tax/legal entries reviewed against primary texts; unverified entries stay flagged in the UI.
- [ ] Health check: `GET /actuator/health`.

No CI deploy job exists yet (the check job only tests and builds). Add one modelled on
`.github/workflows/deploy-kira-bank.yml` once registry and Portainer secrets are available.
