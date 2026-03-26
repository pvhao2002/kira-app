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
KIRA_TOOL_SERVICE_HOST=host.docker.internal
KIRA_TOOL_SERVICE_PORT=1406
```

Neu service chay bang Docker cung network rieng, set `*_HOST` thanh ten container/service tuong ung.

## Gateway load balancing

- Upstream gateway dang dung `least_conn` de phan pho request den instance it ket noi nhat.
- Mac dinh da khai bao 3 instance (`8888`, `8889`, `8890`), ban chi can chay nhieu gateway tren cac port nay hoac override trong `.env`.
- Sau khi doi `.env`, reload:

```bash
cd nginx
docker compose up -d --force-recreate
```
