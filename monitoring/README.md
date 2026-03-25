# Loki + Promtail + Grafana (Docker)

Theo dõi log: Promtail đọc từ **một folder chung** (service/UI chạy IntelliJ ghi vào đó) và/hoặc từ log container Docker → Loki → Grafana.

## Cách gộp log từ IntelliJ (khuyến nghị)

Các service chạy trên IntelliJ ghi log vào **`logs/`** ở root project. Promtail đọc từ folder đó → không cần Docker cho app, đơn giản và nhanh.

- **kira-service**, **kira-queue**, **tool-service**: đã cấu hình `logging.file.name` → `../logs/<tên>.log` (mặc định khi run từ thư mục module).
- Nếu IntelliJ chạy với working directory khác (ví dụ root project): set env **`LOG_DIR`** = `logs` hoặc đường dẫn tuyệt đối tới `logs/`.
- Trong Grafana (Loki): filter theo label **`service`**, ví dụ `{job="kira", service="kira-service"}`.

## Chạy stack

Monitoring nằm trong **`docker-compose.yml` ở root project** (cùng nhóm với mysql, rabbitmq).

```bash
# Từ thư mục root kira_app
docker compose up -d
```

Chỉ chạy monitoring (không đụng mysql/rabbitmq nếu đã up):  
`docker compose up -d loki promtail grafana`

- **Loki**: http://localhost:3100  
- **Grafana**: http://localhost:3000 (user: `admin`, pass: `admin`)  
- **Promtail**: đọc `./logs/*.log` (mount thành `/var/log/kira`).

## Cấu hình Grafana

1. Đăng nhập Grafana (admin / admin).
2. **Connections** → **Data sources** → **Add data source** (hoặc mở data source Loki đã tạo) → chọn **Loki**.
3. **URL bắt buộc**: `http://loki:3100` (Grafana chạy trong container nên phải dùng tên service `loki`, **không** dùng `localhost:3100`).
4. **Save & test**.

## Xem log

- Vào **Explore** (icon la bàn) → chọn data source **Loki**.
- LogQL ví dụ:
  - **Log từ IntelliJ (folder chung)**: `{job="kira"}`, `{job="kira", service="kira-service"}`, `{job="kira"} |= "error"`
  - Log container Docker: `{container_name="mysql"}`, `{container_name="rabbitmq"}`
  - Tất cả: `{}`

## Linux vs Docker Desktop (Mac/Windows)

- **Linux**: Volume `/var/lib/docker/containers` có trên host → Promtail đọc trực tiếp log file của mọi container.
- **Mac/Windows (Docker Desktop)**: Path đó nằm trong VM, container Promtail không đọc được. Hai lựa chọn:
  1. **Loki Docker logging driver**: mỗi service gửi log thẳng tới Loki (không cần Promtail). Cài plugin và thêm `logging` vào từng service (xem reference.md).
  2. Chạy stack này trên máy Linux hoặc VM Linux có Docker.

## Nhiều consumer / nhiều máy (kira-queue)

Để thu thập log từ **nhiều consumer** (có thể trên **nhiều máy**) và dễ tracking:

### 1. Đặt tên từng consumer (app)

Với **kira-queue**, set env **`INSTANCE_ID`** khi chạy mỗi process (IntelliJ Run Configuration, systemd, Docker, …):

- `INSTANCE_ID=worker-1` → log ghi vào `logs/kira-queue-worker-1.log`
- `INSTANCE_ID=worker-2` → `logs/kira-queue-worker-2.log`
- Trên máy khác: `INSTANCE_ID=host-a-consumer` → `logs/kira-queue-host-a-consumer.log`

Không set thì mặc định dùng `kira-queue-local.log`. Trong Loki, label **`service`** = tên file không đuôi (vd. `kira-queue-worker-1`).

### 2. Promtail trên mỗi máy

Trên **từng máy** có consumer chạy:

1. Cài Promtail (binary hoặc Docker), dùng config **`promtail-distributed.yaml`**.
2. Chạy với **`-config.expand-env=true`** và set env:
   - **`LOKI_URL`**: URL Loki trung tâm (vd. `http://loki-server:3100`)
   - **`INSTANCE_NAME`** (tùy chọn): tên máy/instance (vd. `worker-node-1`), dùng làm label trong Grafana
   - **`LOG_PATH`** (tùy chọn): thư mục chứa file log, mặc định `/var/log/kira`
3. Mount thư mục log của máy đó vào Promtail (vd. `logs` của project → `/var/log/kira`).

Ví dụ (Docker):

```bash
docker run -d --name promtail \
  -v /path/to/logs:/var/log/kira:ro \
  -v /path/to/monitoring/promtail-distributed.yaml:/etc/promtail/config.yaml \
  -e LOKI_URL=http://<loki-server>:3100 \
  -e INSTANCE_NAME=worker-node-1 \
  grafana/promtail:3.5.12 \
  -config.file=/etc/promtail/config.yaml -config.expand-env=true
```

Trong Grafana (Loki) bạn sẽ có:

- **`host`**: hostname máy chạy Promtail (tự lấy nếu không set `INSTANCE_NAME`)
- **`instance`**: giá trị `INSTANCE_NAME` (hoặc `unknown`)
- **`service`**: tên file log (vd. `kira-queue-worker-1`)

LogQL ví dụ: `{job="kira", service=~"kira-queue-.*"}`, `{job="kira", host="worker-node-1"}`, `{job="kira", service="kira-queue-worker-1"} |= "error"`.

### 3. Loki trung tâm

Loki cần chạy ở một nơi mà tất cả Promtail gửi log tới (cùng mạng hoặc expose port). Đảm bảo firewall/security group cho phép máy consumer kết nối tới cổng Loki (3100).

---

## File cấu hình (thư mục `monitoring/`)

| File | Vai trò |
|------|---------|
| `loki-config.yaml` | Cấu hình Loki |
| `promtail-config.yaml` | Promtail (log từ `./logs`) |
| `promtail-distributed.yaml` | Promtail trên máy khác (multi-host) |
| `grafana/provisioning/datasources/loki.yaml` | Data source Loki tự provision |

Các container trong cùng Docker host có thể thêm job Docker trong Promtail + mount socket (Linux) để thu thập log container.
