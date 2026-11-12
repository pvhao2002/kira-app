# VPS deployment

Target: `ubuntu@168.107.90.219`, application directory `/opt/kira-tool`.

- One backend container (Node.js 24 + Google Chrome Stable): hard limit 1 GiB including Chrome, one worker.
- Static UI container: hard limit 512 MiB.
- Both ports bind only to loopback: service `1407`, UI `4202`.
- Host NGINX terminates TLS for `kira.id.vn` and `tool.kira.id.vn`. The existing UI stays on port `4200`.
- SQLite (`tool.db`) and PDFs persist in `/opt/kira-tool/data` and `/opt/kira-tool/storage`. Old H2 files from the Java release (`tooldb.*`) are no longer read; jobs start empty after the switch.
- Do not scale the backend: SQLite and in-memory coordination support one instance only.

## Layout and updates

Copy the service source to `app/` (`kira-tool-service/package.json`, `package-lock.json` and `src/`; no `node_modules`), Angular `dist/kira-tool-ui/browser/` contents to `ui/`, and this directory to `deploy/` under `/opt/kira-tool`. The image installs dependencies with `npm ci --omit=dev` and Chrome with `npx --no-install patchright install chrome`. On Linux ARM64, `patch-chrome-installer.mjs` patches the locked Patchright installer to select Google's ARM64 package. The service launches Chrome using `channel: 'chrome'`.

The image runs as user `tool` with UID/GID `1001:1001` (same owner as the previous Java image). Data and storage directories must be owned by that identity with mode `750`; verify with `docker run --rm --entrypoint id kira-tool-service:local` when changing the base image.

Before replacing an existing release, stop the backend and back up `app`, `ui`, `data`, and `storage` together. Never delete data during an update.

```sh
cd /opt/kira-tool/deploy
sudo docker compose config -q
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail=100 service
sudo docker stats --no-stream
```

`switch-nginx.sh` is a **one-time Caddy migration**, not an update script. It preserves the existing certificate during cutover, obtains Certbot certificates, and removes the Caddy package only after HTTPS checks. The saved Caddy configuration and temporary certificate copy remain for recovery.

The installed NGINX site is `/etc/nginx/sites-available/kira`. Its final certificate paths use `/etc/letsencrypt/live/<domain>/`. `nginx.conf` contains the initial migration paths for the old domain; do not copy it directly over the final installed configuration.

Cloudflare source ranges are validated and installed in `/etc/nginx/conf.d/cloudflare-real-ip.conf`; only these proxies can supply `CF-Connecting-IP`. NGINX overwrites the forwarded client-IP header sent to the backend.

Certbot renewal uses a webroot exception on port 80 and a deploy hook to validate/reload NGINX. Check with `sudo certbot renew --dry-run`.

## Checks

```sh
curl -I https://kira.id.vn/
curl -I https://tool.kira.id.vn/
curl -i https://tool.kira.id.vn/tool-service/api/v1/jobs
curl -i -X POST -H 'Content-Type: application/json' --data '{}' https://tool.kira.id.vn/tool-service/api/v1/jobs
# GET: 200 and Secure owner/CSRF cookies. POST without CSRF: 403.
```

Provider downloads require a separate real public Google Drive/Scribd document test. A successful deployment smoke check does not prove extraction against those sites.
