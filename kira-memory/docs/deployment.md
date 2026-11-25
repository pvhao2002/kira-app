# Deployment

Three containers, defined in `docker-compose.hub.yml` (the Portainer stack file):

| Container | Image | Notes |
|---|---|---|
| `kira-memory-ui` | `kira2308/kira-memory-ui` | nginx: the app + same-origin proxy of `/api`, `/api/events` (SSE) and `/m` (media). The only published port (`UI_PORT`, default 4206) |
| `kira-memory-service` | `kira-memory-service` (`kira2308/…`) | Java 25, patched Corretto (checked by `scripts/check_java_image.py`). Not published. Volume `upload-tmp` at `/data/uploads` |
| `mysql` | `mysql:8.0` | Volume `mysql-data`. Flyway creates the schema and the two accounts on first start |

## Pipeline
`.github/workflows/deploy-kira-memory.yml`, on every push to `master` touching `kira-memory/**`:
1. service `mvn verify` (Testcontainers) and UI unit tests;
2. build and push `kira2308/kira-memory-service` and `kira2308/kira-memory-ui` (`latest` + commit SHA), and fail if the
   service image does not run the patched JVM;
3. redeploy the Portainer stack with image re-pull (skipped, with a message, until the secrets below exist).

GitHub secrets: `DOCKERHUB_TOKEN` (already used by other modules), `KIRA_MEMORY_PORTAINER_URL`,
`KIRA_MEMORY_PORTAINER_API_KEY`, `KIRA_MEMORY_PORTAINER_STACK_ID`, `KIRA_MEMORY_PORTAINER_ENDPOINT_ID`.

## First install (once)
1. In Portainer: Stacks → Add stack → paste `docker-compose.hub.yml`, and set the environment below.
2. Deploy, then put the stack id and endpoint id into the GitHub secrets above.
3. Point the domain at `UI_PORT` through Cloudflare (proxied, SSL mode Full) or a Cloudflare Tunnel.
4. Cloudflare → Caching → Cache Rules: "URI Path starts with `/m/`" → Eligible for cache, Edge TTL: respect origin.
   (jpg/png/gif/webp/mp4/webm are cached without it; heic/mov/avif need the rule.)
5. Log in as `admin`, open Cài đặt and check the storage cards say "Sẵn sàng".

## Stack environment
| Variable | Required | Notes |
|---|---|---|
| `DB_ROOT_PASSWORD`, `DB_PASSWORD` | yes | random; the stack will not start without them |
| `JWT_SECRET` | yes | ≥ 32 random chars (`openssl rand -base64 48`). Changing it logs both of you out |
| `MEDIA_URL_SECRET` | yes | ≥ 32 random chars. **Never change after launch**: every media URL (and Cloudflare's cache of it) changes |
| `HF_DATASET_REPO`, `HF_TOKEN` | for Hugging Face (default storage) | a **private** dataset repo, token with write access |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | for R2 | endpoint `https://<account-id>.r2.cloudflarestorage.com`; token scoped to the bucket |
| `COOKIE_SECURE` | no (default `true`) | keep `true`: the site must be served over HTTPS |
| `UI_PORT` | no (default 4206) | host port of the nginx container |
| `IMAGE_TAG` | no (default `latest`) | pin a commit SHA to roll back |
| `UPLOAD_PARALLEL_STORES` | no (default 2) | uploads pushed to HF/R2 at the same time |

## Capacity
- One service instance only: upload sessions, SSE fan-out and the login limiter are in memory (marked `ponytail:`).
- Disk: `upload-tmp` needs room for the files being uploaded at once (a 2 GB video needs 2 GB + 512 MB headroom,
  else the upload is refused with "Máy chủ không đủ chỗ trống"). Unfinished uploads are removed after 24 h.
- Memory: the service never holds an upload in RAM; 512 MB–1 GB for the container is plenty for two people.
- Cloudflare does not cache files over 512 MB, so long videos stream through the service on every view.

## Operations
- Health: `docker inspect --format '{{.State.Health.Status}}'` on the service container (`/actuator/health`; not
  reachable through nginx).
- Back up the `mysql-data` volume. Media lives in Hugging Face/R2; the database holds which provider and key each
  item uses, captions, albums and messages.
- Roll back: set `IMAGE_TAG` to an earlier commit SHA and redeploy the stack.
