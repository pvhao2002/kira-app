# R2 logo upload (logo_queue)

## One-time setup

1. **MySQL migration** (if not applied):

```bash
mysql -h 127.0.0.1 -P 3310 -u kira_user -pkira_password kira < ../database/migrate_leagues_teams_logo_r2.sql
```

2. **Cloudflare R2 env** (bucket `kira-r2` on account `451bc9b2fc048e958bffb2e78b9f8ca9`):

```bash
export CLOUDFLARE_API_TOKEN="your_token"   # API Tokens → R2 Edit on kira-r2
./scripts/setup-r2-env.sh
```

Script will:
- Enable public **r2.dev** URL on bucket `kira-r2`
- Write `R2_*` variables to repo `.env` and `kira-queue/.env`

3. **Run** MySQL + RabbitMQ, then **kira-queue** (IntelliJ or `mvn spring-boot:run`).

After a date crawl, `CrawDateServiceV2` enqueues `logo_queue`; consumer downloads `logo_url` and uploads to R2, saving public URL in `logo`.

## Env vars

| Variable | Description |
|----------|-------------|
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY` / `R2_SECRET_KEY` | R2 S3 API token |
| `R2_BUCKET` | `kira-r2` |
| `R2_PUBLIC_BASE_URL` | Public r2.dev base URL (no trailing slash) |

`springboot3-dotenv` loads `.env` from the working directory (`kira-queue/` or repo root if you copy `.env` there).
