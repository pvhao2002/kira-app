# Kira App Monorepo

## Tổng quan kiến trúc

- `kira-ui`: Frontend web (Angular 21).
- `mobile-app`: Ứng dụng mobile (Expo/React Native).
- `kira-gateway`: Cổng API public, chịu trách nhiệm auth + routing vào các service nội bộ.
- `kira-service`: Business API chính.
- `kira-producer`: Lịch đẩy ngày/sự kiện cần crawl lên RabbitMQ (tách khỏi API nếu cần).
- `kira-queue`: Xử lý hàng đợi và tác vụ async (RabbitMQ).
- `kira-crawl`: Service thu thập và chuẩn hóa dữ liệu đầu vào cho pipeline phân tích.
- `kira-schema`: Module schema/entity dùng chung cho các service backend.
- `kira-tool-service`: Service công cụ/phụ trợ.
- `kira-websocket`, `kira-data-manager`: Các service mở rộng theo nhu cầu realtime/data.
- `database`: SQL scripts cho schema, migration và vận hành DB.
- `model-ai`: Cấu hình/chạy các thành phần phục vụ AI pipeline.
- `n8n`: Workflow automation tích hợp dịch vụ ngoài hệ thống.

## Technical Overview (focus kỹ thuật)

### 1) Kiến trúc xử lý dữ liệu (event-driven)

- **Entry layer**: `kira-gateway` là cổng API public, gom auth/security + điều phối vào service nội bộ.
- **Core API layer**: `kira-service` xử lý API nghiệp vụ đồng bộ.
- **Async layer**:
  - `kira-producer` chạy scheduler, publish job crawl vào RabbitMQ theo batch.
  - `kira-queue` tiêu thụ queue, chạy crawler/parser và cập nhật DB.
  - `kira-crawl` tách riêng luồng crawl/normalize từ nguồn ngoài khi cần scale độc lập.
- **Data layer**: MySQL theo mô hình primary/replica; các service có cấu hình datasource read/write để tối ưu tải đọc.
- **Observability layer**: log file -> Promtail -> Loki -> Grafana.

### 2) Công nghệ sử dụng

- **Backend**: Java 21 + Spring Boot (đa module), Maven.
- **Messaging**: RabbitMQ (`spring-boot-starter-amqp`).
- **Data access**: Spring JDBC (`NamedParameterJdbcTemplate`) + JPA ở module schema dùng chung.
- **Crawler stack**: Playwright Java + Jsoup (DOM parsing).
- **Web frontend**: Angular 21 + RxJS + Tailwind CSS.
- **Mobile**: Expo + React Native + React 19.
- **Infra local**: Docker Compose, Nginx reverse proxy, MySQL, Grafana/Loki/Promtail.

### 3) Kỹ thuật triển khai chính

- **Queue backpressure**: scheduler kiểm tra ngưỡng message trong queue trước khi publish thêm để tránh quá tải worker.
- **Claim-based concurrency control**:
  - Dùng bảng `event_claim` để đánh dấu event đang được xử lý.
  - Có cơ chế stale timeout để tránh lock logic vĩnh viễn khi worker lỗi.
- **Idempotent write**:
  - Nhiều điểm ghi DB dùng `INSERT ... ON DUPLICATE KEY UPDATE` để retry an toàn.
  - Giảm nguy cơ ghi trùng khi job được phát lại.
- **Retry + backfill strategy**:
  - Ưu tiên event fail trước (retry queue), sau đó backfill event còn thiếu dữ liệu odds/stats.
  - Áp dụng batch limit theo từng scheduler tick.
- **Crawl hardening**:
  - Playwright cấu hình user-agent, locale, timezone, context gần với browser thật.
  - Có timeout cho crawl song song để tránh treo tác vụ.
  - Lưu dấu lỗi (message/html/screenshot) hỗ trợ debug post-mortem.
- **Tách scheduler tránh duplicate**:
  - Khi chạy `kira-producer`, có thể tắt schedule tương ứng ở `kira-service` qua env để tránh publish trùng.
- **Reverse proxy topology**:
  - Nginx route `/api`, `/queue`, `/gateway`, `/data`, `/tool-service`.
  - Hỗ trợ load balancing nhiều instance gateway/data-manager.

### 4) Luồng kỹ thuật điển hình (crawl event)

1. `kira-producer` quét danh sách event cần crawl và publish event-id vào RabbitMQ.
2. `kira-queue` consume message, dùng Playwright/Jsoup thu thập và parse dữ liệu.
3. Worker ghi dữ liệu vào MySQL (odds/result/issue tables), cập nhật trạng thái crawl.
4. Với lỗi crawl, worker ghi bảng fail/issue để hệ thống retry ở các tick sau.
5. Log runtime của toàn bộ service được đẩy về Loki để truy vấn trong Grafana.


## Cấu trúc thư mục chính

```text
kira-app/
|- docker-compose.yml          # Infra local: MySQL primary/replica, RabbitMQ, Loki, Promtail, Grafana, Nginx
|- database/                   # SQL scripts: schema, migration, health-check
|- kira-ui/                    # Angular web app
|- mobile-app/                 # Expo mobile app
|- kira-gateway/               # API gateway (default: :8888/gateway)
|- kira-service/               # Core business service (default: :2308/api)
|- kira-queue/                 # Queue worker/API (default: :2323/queue)
|- kira-producer/              # Scheduler đẩy date/event crawl lên RabbitMQ (HTTP actuator default: :2311)
|- kira-crawl/                 # Crawl service (default: :2400/crawl)
|- kira-schema/                # Shared schema/entities for backend modules
|- kira-data-manager/          # Data manager APIs/monitoring endpoints
|- kira-websocket/             # Realtime channel/service
|- kira-tool-service/          # Tool service (default: :1406/tool-service)
|- model-ai/                   # AI-related services and compose config
|- n8n/                        # Automation workflows (n8n)
|- monitoring/                 # Loki/Promtail/Grafana configs
|- nginx/                      # Reverse proxy config
```

## Yêu cầu môi trường

- Docker + Docker Compose
- Java 21 (cho các service Spring Boot)
- Node.js + npm (cho `kira-ui` và `mobile-app`)
- (Khuyến nghị) IDE: IntelliJ cho backend, Cursor/VS Code cho frontend

## Chạy nhanh local

### 1) Khởi động hạ tầng dùng Docker

Từ thư mục root:

```bash
docker compose up -d
```

Stack này gồm:

- MySQL primary (`3310`) + MySQL replica (`3311`)
- RabbitMQ (`5672`, UI: `15672`); tùy chọn `kira-producer` (`build: ./kira-producer`, port `2311`) đẩy job crawl lên queue
- Loki (`3100`) + Promtail
- Grafana (`3000`, mặc định `admin/admin`)
- Nginx reverse proxy (`80`)

### 2) Chạy backend services

Mỗi service là một project Maven độc lập. Có thể chạy bằng IDE hoặc CLI:

```bash
# ví dụ với một service
cd kira-service
mvn spring-boot:run
```

Các cổng/context-path mặc định:

- `kira-gateway`: `http://localhost:8888/gateway`
- `kira-service`: `http://localhost:2308/api`
- `kira-producer` (Rabbit publish + actuator): `http://localhost:2311` — khi chạy `kira-producer` (hoặc stack Docker), đặt `KIRA_CRAWL_SCHEDULE_ENABLED=false` trên `kira-service` để tắt lịch crawl trùng.
- `kira-queue`: `http://localhost:2323/queue`
- `kira-crawl`: `http://localhost:2400/crawl`
- `kira-tool-service`: `http://localhost:1406/tool-service`

### 3) Chạy web app

```bash
cd kira-ui
npm install
ng serve
```

Web chạy tại `http://localhost:4200`.

`kira-ui` đang gọi auth qua `/gateway/*` (proxy sang gateway trong local dev).

### 4) Chạy mobile app

```bash
cd mobile-app
npm install
npx expo start
```

## Reverse proxy (Nginx)

Nếu dùng Nginx ở local (`http://localhost`):

- `/api/...` -> `kira-service`
- `/queue/...` -> `kira-queue`
- `/gateway/...` -> `kira-gateway` (có load balancing nhiều instance)
- `/tool-service/...` -> `kira-tool-service`

Xem thêm cấu hình tại `nginx/README.md`.

## Logging & Monitoring

- Backend logs được gom về thư mục `logs/` để Promtail đẩy lên Loki.
- Xem log/truy vấn tại Grafana (`http://localhost:3000`).
- Các file cấu hình monitoring nằm trong `monitoring/`.

## Tài liệu chi tiết theo module

- `kira-ui/README.md`
- `mobile-app/README.md`
- `kira-service/README.md`
- `model-ai/README.md`
- `n8n/README.md`
- `monitoring/README.md`
- `nginx/README.md`

