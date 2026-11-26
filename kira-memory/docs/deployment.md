# Deployment

Production: `https://memory.kira.id.vn`, on the Oracle Ampere A1 VPS (arm64, 24 GB) shared with MatchMind.

Request path: Cloudflare (proxied, SSL mode Full (strict)) → host nginx vhost `memory.kira.id.vn` (Cloudflare Origin
certificate) → `127.0.0.1:4206` (UI container) → service → MySQL.

Three containers, defined in `docker-compose.vps.yml` (compose project `kira-memory`, built on the server from this
folder, in `~/kira-memory`):

| Container | Build | Notes |
|---|---|---|
| `kira-memory-ui` | `kira-memory-ui/` | nginx: the app + same-origin proxy of `/api`, `/api/events` (SSE) and `/m` (media). The only published port, on loopback (`127.0.0.1:${UI_PORT}`, default 4206). 128 MB |
| `kira-memory-service` | `kira-memory-service/` | Java 25, patched Corretto (checked by `scripts/check_java_image.py`). Not published. Volume `upload-tmp` at `/data/uploads`. 1 GB |
| `mysql` | `mysql:8.0` | Volume `mysql-data`. Flyway creates the schema and the two accounts on first start. 1 GB |

`docker-compose.hub.yml` is the same stack from the Docker Hub images (amd64 only, for a Portainer host). Production does
not use it.

## Pipeline
`.github/workflows/deploy-kira-memory.yml`, on every push to `master` touching `kira-memory/**`:
1. service `mvn verify` (Testcontainers) and UI unit tests;
2. build and push `kira2308/kira-memory-service` and `kira2308/kira-memory-ui` (amd64, `latest` + commit SHA), and fail
   if the service image does not run the patched JVM;
3. after the tests (not the image push): upload this folder to the VPS over SSH, swap it into `~/kira-memory` (the live
   `.env` is kept; the old tree stays as `~/kira-memory.bak-ci-<time>-<sha>`, the newest 3 are kept), run
   `docker compose -f docker-compose.vps.yml up -d --build`, wait for the service health check, then probe the UI and API.

GitHub secrets: `DOCKERHUB_TOKEN`, and the ones shared with MatchMind's deploy (environment `production`):
`MATCHMIND_VPS_HOST`, `MATCHMIND_VPS_USER`, `MATCHMIND_VPS_SSH_KEY`, `MATCHMIND_VPS_KNOWN_HOSTS`.

A manual deploy is the same step 3 by hand: pack the folder without `.env`, `node_modules`, `dist`, `.angular` and
`target`, copy the live `.env` into the new tree, swap, `up -d --build`.

## First install (once)
1. On the VPS: `~/kira-memory/.env` (chmod 600) with the environment below plus `COMPOSE_FILE=docker-compose.vps.yml`,
   then `docker compose up -d --build`.
2. Host nginx: `/etc/nginx/sites-available/kira-memory`, symlinked into `sites-enabled`. Port 80 → 301 to https; 443 with
   `/etc/ssl/cloudflare/kira.id.vn.pem`/`.key`, `proxy_pass http://127.0.0.1:4206`, `client_max_body_size 40m`,
   `proxy_buffering off`, `proxy_request_buffering off`, `proxy_read_timeout 1h`. No security headers there: the UI
   container sets them. Back up `/etc/nginx` and run `sudo nginx -t` before `sudo systemctl reload nginx`. MatchMind's
   vhost is the `default_server`, so without this vhost the domain shows MatchMind.
3. Cloudflare DNS: `memory` → the VPS, proxied.
4. Cloudflare → Caching → Cache Rules: "Hostname equals `memory.kira.id.vn` and URI Path starts with `/m/`" → Eligible
   for cache, Edge TTL: respect origin. (jpg/png/gif/webp/mp4/webm are cached without it; iPhone heic/mov and avif
   need the rule.)
5. Accounts: `admin` (admin) and `love` (viewer), both with the seed password from `V1__init.sql`; production keeps it
   by the owner's choice. It is public in this repo and is the date on the login page, so to make the site private,
   change it on Tài khoản ("Đổi mật khẩu", then "Đặt lại mật khẩu cho Em").
6. Cài đặt: check the storage cards say "Sẵn sàng".

## Environment (`~/kira-memory/.env`)
| Variable | Required | Notes |
|---|---|---|
| `DB_ROOT_PASSWORD`, `DB_PASSWORD` | yes | random; the stack will not start without them |
| `JWT_SECRET` | yes | ≥ 32 random chars (`openssl rand -base64 48`). Changing it logs both of you out |
| `MEDIA_URL_SECRET` | yes | ≥ 32 random chars. **Never change after launch**: every media URL (and Cloudflare's cache of it) changes |
| `HF_DATASET_REPO`, `HF_TOKEN` | for Hugging Face (default storage) | a **private** dataset repo, token with write access |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | for R2 | endpoint `https://<account-id>.r2.cloudflarestorage.com`; token scoped to the bucket |
| `COOKIE_SECURE` | no (default `true`) | keep `true`: the site must be served over HTTPS |
| `UI_PORT` | no (default 4206) | loopback port of the nginx container |
| `UPLOAD_PARALLEL_STORES` | no (default 2) | uploads pushed to HF/R2 at the same time |
| `CF_ZONE_ID`, `CF_API_TOKEN`, `CF_SITE_URL` | no | purge deleted media from Cloudflare's cache: the zone id of `kira.id.vn`, an API token with Zone → Cache Purge on it, and `https://memory.kira.id.vn`. Off while any is blank |
| `IMAGE_TAG` | no (default `latest`) | `docker-compose.hub.yml` only: pin a commit SHA to roll back |

## Capacity
- One service instance only: upload sessions, SSE fan-out and the login limiter are in memory (marked `ponytail:`).
- Disk: `upload-tmp` needs room for the files being uploaded at once (a 2 GB video needs 2 GB + 512 MB headroom,
  else the upload is refused with "Máy chủ không đủ chỗ trống"). Unfinished uploads are removed after 24 h.
- Memory: the service never holds an upload in RAM; the limits above leave the rest of the VPS to MatchMind.
- Cloudflare does not cache files over 512 MB, so long videos stream through the service on every view.
- SSE: the service sends a heartbeat every 25 s, under Cloudflare's 100 s idle cut; the app reconnects and catches up.

## Operations
- Health: `docker inspect --format '{{.State.Health.Status}}' kira-memory-kira-memory-service-1`
  (`/actuator/health`; not reachable through nginx).
- Back up the `mysql-data` volume. Media lives in Hugging Face/R2; the database holds which provider and key each
  item uses, captions, albums and messages.
- Roll back: `cd ~ && mv kira-memory kira-memory.failed && mv kira-memory.bak-ci-<…> kira-memory`, then
  `cd kira-memory && docker compose up -d --build`. The database is not rolled back: migrations only add.
- Passwords: changing one signs that account out on its other devices; the admin can reset Em's on Tài khoản.
- Deleting a photo also purges its two URLs from Cloudflare's cache when the `CF_*` variables are set. Without them,
  or when the purge fails (logged, never fatal), Cloudflare can keep serving a cached copy at the old URL: purge it in
  Caching → Configuration → Custom Purge → Prefix `memory.kira.id.vn/m/<id>/`.
- Cloudflare Web Analytics, if enabled for the zone, injects a beacon that the CSP blocks (one console error, no data
  sent). Exclude this hostname there to silence it.
