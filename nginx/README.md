# Nginx reverse proxy for Kira services

## Chay nhanh

```bash
cd nginx
docker compose up -d
```

MacOS se route toi cac service local qua `host.docker.internal`.

## Duong dan proxy

- `http://localhost/api/...` -> `kira-service` (`:2308`)
- `http://localhost/queue/...` -> `kira-queue` (`:2323`)
- `http://localhost/gateway/...` -> load balance qua nhieu instance `kira-gateway`
- `http://localhost/data/...` -> load balance 2 instance `kira-data-manager` (context-path `/data`, mac dinh `9198` / `9199`)
- `http://localhost/tool-service/...` -> `kira-tool-service` (`:1406`)
- `http://localhost/healthz` -> health check Nginx

## Tuy chinh host/port

Co the tao file `nginx/.env` de override:

```env
NGINX_PORT=80
KIRA_SERVICE_HOST=host.docker.internal
KIRA_SERVICE_PORT=2308
KIRA_QUEUE_HOST=host.docker.internal
KIRA_QUEUE_PORT=2323
KIRA_GATEWAY_HOST_1=host.docker.internal
KIRA_GATEWAY_PORT_1=8888
KIRA_GATEWAY_HOST_2=host.docker.internal
KIRA_GATEWAY_PORT_2=8889
KIRA_GATEWAY_HOST_3=host.docker.internal
KIRA_GATEWAY_PORT_3=8890
KIRA_DATA_MANAGER_HOST_1=host.docker.internal
KIRA_DATA_MANAGER_PORT_1=9198
KIRA_DATA_MANAGER_HOST_2=host.docker.internal
KIRA_DATA_MANAGER_PORT_2=9199
KIRA_TOOL_SERVICE_HOST=host.docker.internal
KIRA_TOOL_SERVICE_PORT=1406
```

Neu service chay bang Docker cung network rieng, set `*_HOST` thanh ten container/service tuong ung.

### 502 Bad Gateway / upstream IPv6 "Network unreachable"

Nginx log dang `connect() to [xxxx:....]:port failed (101: Network unreachable)` nghia la upstream duoc resolve sang **IPv6** trong khi container/nginx **khong route duoc IPv6** (rat hay gap voi Docker hoac hostname chi tra AAAA).

**Cach xu ly:**

1. **Docker Compose (dev):** Image nginx da co `extra_hosts: host.docker.internal:host-gateway` de tro host bang IPv4. Sau khi pull thay doi, chay lai: `docker compose up -d --force-recreate nginx`.
2. **Production:** Dat `KIRA_GATEWAY_HOST_1` (va `_2`, `_3` neu dung) thanh **dia chi IPv4** cua gateway, hoac hostname **chi** co ban ghi A (IPv4), khong dung hostname ma DNS tra ve IPv6 ma mang khong toi duoc.
3. **K8s/VM:** Bat IPv6 dau den container den gateway, hoac dung Service/ClusterIP IPv4 thay vi hostname cloud tra AAAA.

## Gateway load balancing

- Upstream gateway: 3 `server` trong cung `upstream` (round-robin). Co `proxy_next_upstream` de thu peer khac khi connect/5xx.
- Mac dinh da khai bao 3 instance (`8888`, `8889`, `8890`), ban chi can chay nhieu gateway tren cac port nay hoac override trong `.env`.

## kira-data-manager (2 instance)

- Upstream: 2 `server` (round-robin), `max_fails` + `proxy_next_upstream` de chuyen sang instance con song khi mot peer loi connect/5xx.
- Mac dinh `9198` / `9199` — instance thu hai can `server.port: 9199` (hoac override env).
- Chi chay 1 instance local: dat ca `KIRA_DATA_MANAGER_PORT_1` va `KIRA_DATA_MANAGER_PORT_2` cung port (vi du `9198`) de ca hai peer tro ve cung JVM.
- Sau khi doi `.env`, reload:

```bash
cd nginx
docker compose up -d --force-recreate
```
