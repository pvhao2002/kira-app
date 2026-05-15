# Nginx reverse proxy for Kira services

## Chay nhanh

```bash
cd nginx
docker compose up -d
```

MacOS se route toi cac service local qua `host.docker.internal`.

## Duong dan proxy

- `http://localhost/` (hoac `http://kira.local/` neu da cau hinh) -> **kira-ui** (`ng serve` tren host, mac dinh `:4200`, hoac container `kira-ui:80` khi dung profile `ui`)
- `http://localhost/api/...` -> `kira-service` (`:2308`)
- `http://localhost/queue/...` -> `kira-queue` (`:2323`)
- `http://localhost/gateway/...` -> load balance 2 instance `kira-gateway` (mac dinh `6868` / `6869`)
- `http://localhost/data/...` -> load balance 2 instance `kira-data-manager` (context-path `/data`, mac dinh `7777` / `7778`)
- `http://localhost/tool-service/...` -> `kira-tool-service` (`:1406`)
- `http://localhost/healthz` -> health check Nginx

### Domain local (kira.local)

Them vao `/etc/hosts` (macOS/Linux): `127.0.0.1 kira.local`. `NGINX_SERVER_NAME` mac dinh la `localhost kira.local`; truy cap `http://kira.local` (cong Nginx, thuong 80). Trong `kira-ui/angular.json`, `allowedHosts` da gom `kira.local` va `localhost` de dev server chap nhan `Host` gui tu Nginx.

**Doi template/env nginx:** image nginx generate `conf.d` luc **start** container — sau khi doi `templates/` hoac bien moi truong, chay `docker compose up -d --force-recreate nginx` (tu root repo hoac `nginx/`). Chi `nginx -s reload` khi ban sua file `.conf` da mount san (khong qua envsubst).

## Tuy chinh host/port

Co the tao file `nginx/.env` de override:

```env
NGINX_PORT=80
KIRA_SERVICE_HOST=host.docker.internal
KIRA_SERVICE_PORT=2308
KIRA_QUEUE_HOST=host.docker.internal
KIRA_QUEUE_PORT=2323
KIRA_GATEWAY_HOST_1=host.docker.internal
KIRA_GATEWAY_PORT_1=6868
KIRA_GATEWAY_HOST_2=host.docker.internal
KIRA_GATEWAY_PORT_2=6869
KIRA_DATA_MANAGER_HOST_1=host.docker.internal
KIRA_DATA_MANAGER_PORT_1=7777
KIRA_DATA_MANAGER_HOST_2=host.docker.internal
KIRA_DATA_MANAGER_PORT_2=7778
KIRA_TOOL_SERVICE_HOST=host.docker.internal
KIRA_TOOL_SERVICE_PORT=1406
KIRA_UI_HOST=host.docker.internal
KIRA_UI_PORT=4200
NGINX_SERVER_NAME=localhost kira.local
```

Neu service chay bang Docker cung network rieng, set `*_HOST` thanh ten container/service tuong ung. Root repo co san `.env.compose-apps.example` de tro Nginx toi cac app container:

```bash
docker compose --env-file .env.compose-apps.example \
  --profile apps up -d --build
```

### IntelliJ / nhieu request (502 / mat ket noi tam thoi)

- **Upstream keepalive:** `nginx.conf` set `proxy_set_header Connection ""` va upstream `keepalive` de giam lap ket noi TCP Docker -> host (`TIME_WAIT`/can cong tam). Sau khi pull thay doi, `docker compose up -d --force-recreate nginx`.
- **Khong retry theo HTTP 502:** chi retry khi loi ket noi / timeout (`proxy_next_upstream error timeout`), tranh tang gap doi tai len backend da qua tai.
- **Tomcat:** `kira-gateway` va `kira-data-manager` tang `threads.max` / `accept-count`; restart JVM sau khi doi `application.yml`.

### IntelliJ / chi 1 JVM (502 xen ke o `/data`, `/gateway`)

Nginx mac dinh LB 2 upstream (`7777`/`7778`, `6868`/`6869`) toi `host.docker.internal`. Neu ban **chi** chay mot `kira-data-manager` hoac mot `kira-gateway` tren host thi moi ~2 request se co upstream **connection refused** -> client thay **502 Bad Gateway** (vd `ng serve` proxy qua `localhost:80`).

**Cach xu ly:** tro ca `_1` va `_2` ve **cung port** dang listen tren IntelliJ. Dung file mau o root repo:

```bash
docker compose --env-file .env.host-dev.example up -d --force-recreate nginx
```

Chinh port trong `.env.host-dev.example` cho khop Run Configuration cua ban, roi chay lai lenh tren.

### 502 Bad Gateway / upstream IPv6 "Network unreachable"

Nginx log dang `connect() to [xxxx:....]:port failed (101: Network unreachable)` nghia la upstream duoc resolve sang **IPv6** trong khi container/nginx **khong route duoc IPv6** (rat hay gap voi Docker hoac hostname chi tra AAAA).

**Cach xu ly:**

1. **Docker Compose (dev):** Image nginx da co `extra_hosts: host.docker.internal:host-gateway` de tro host bang IPv4. Sau khi pull thay doi, chay lai: `docker compose up -d --force-recreate nginx`.
2. **Production:** Dat `KIRA_GATEWAY_HOST_1` / `_2` thanh **dia chi IPv4** cua gateway, hoac hostname **chi** co ban ghi A (IPv4), khong dung hostname ma DNS tra ve IPv6 ma mang khong toi duoc.
3. **K8s/VM:** Bat IPv6 dau den container den gateway, hoac dung Service/ClusterIP IPv4 thay vi hostname cloud tra AAAA.

## Gateway load balancing

- Upstream gateway: 2 `server` trong cung `upstream` (round-robin). Co `proxy_next_upstream` de thu peer khac khi connect/5xx.
- Mac dinh da khai bao 2 instance (`6868`, `6869`), ban chi can chay nhieu gateway tren cac port nay hoac override trong `.env`.

## kira-data-manager (2 instance)

- Upstream: 2 `server` (round-robin), `max_fails` + `proxy_next_upstream` de chuyen sang instance con song khi mot peer loi connect/5xx.
- Mac dinh `7777` / `7778` — instance thu hai can `server.port: 7778` (hoac override env).
- Chi chay 1 instance local: dat ca `KIRA_DATA_MANAGER_PORT_1` va `KIRA_DATA_MANAGER_PORT_2` cung port (vi du `7777`) de ca hai peer tro ve cung JVM.
- Sau khi doi `.env`, reload:

```bash
cd nginx
docker compose up -d --force-recreate
```
