# Kira Bank

Kira Bank là ứng dụng quản lý tài chính gồm hai miền độc lập: (1) thẻ tín dụng, sao kê, thanh toán, cashback và lợi nhuận hóa đơn chiết khấu; (2) theo dõi website đầu tư với Capital, Profit, Reward, task settlement, withdrawal và append-only ledger.

## Công nghệ và cấu trúc

- `kira-bank-service`: Java 25, Spring Boot 3.5, Security/JWT, JPA, Flyway, MySQL, OpenAPI.
- `kira-bank-ui`: Angular 22 standalone, strict TypeScript, Signals, lazy routes, responsive light/dark UI.
- `docs`: kiến trúc, ERD, business rules, API và production deployment.

Backend là modular monolith. Hai flow không có foreign key nghiệp vụ chéo; dashboard chỉ trình bày hai section riêng.

## Yêu cầu

Java 25, Node `^22.22.3` hoặc `^24.15.0` hoặc `>=26`, npm 8+, Docker Desktop (nếu chạy compose) và MySQL 8 khi chạy thủ công.

## Cấu hình

Sao chép `.env.example` thành `.env` và đổi toàn bộ secret. Các biến chính: `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `AI_BASE_URL`, `AI_API_KEY`.

## Chạy backend

```bash
cd kira-bank-service
./mvnw spring-boot:run
```

MySQL thủ công mặc định ở `localhost:3306`, database/user `kira_bank`. Có thể override bằng `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. Swagger: [localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html).

## Chạy frontend

```bash
cd kira-bank-ui
npm install
npm start
```

Dev server cần proxy `/api` tới port 8080 hoặc backend CORS cho phép origin port 4200.

## Docker Compose

```bash
docker compose up --build
```

UI: [localhost:4200](http://localhost:4200), API: [localhost:8080](http://localhost:8080), MySQL host port 3307. Health check lần lượt chờ MySQL rồi backend trước khi UI khởi động.

## Test

```bash
cd kira-bank-service
./mvnw test

cd ../kira-bank-ui
npm test
```

## Tài khoản development

Chỉ được tạo khi `app.seed-development-users=true` (mặc định development, luôn false trong production):

- Admin: `admin@kira.local` / `KiraAdmin123!`
- User: `user@kira.local` / `KiraUser123!`

## API chính

- Identity: `/api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/profile`, `/change-password`.
- Public: `/api/v1/public/banks`, `/mccs`.
- Flow 1: `/credit-cards`, `/card-transactions`, `/statements`, `/statements/{id}/payments`, `/discount-invoices`.
- Flow 2: `/investment/accounts`, `/deposits/completed`, `/tasks/allocate`, `/tasks/{id}/settlements`, `/withdrawals`, `/accounts/{id}/ledger`.
- Shared: `/attachments` (upload/review; AI không tự lưu dữ liệu tài chính).

## Migration

- `V1__initial_schema.sql`: 33 bảng identity, Flow 1, Flow 2 và shared; foreign key, unique/check constraint và index.
- `V2__seed_public_catalog.sql`: roles, ngân hàng/thẻ/MCC/rule/platform mẫu. Các setting tài chính cũ trong migration này được dọn bởi `V12__remove_unused_tables.sql` vì application dùng invariant trong code. User development được hash và tạo bởi application runner, không hard-code vào production migration.
- `V6__link_user_credit_cards_to_banks.sql`: chuyển thẻ người dùng sang liên kết trực tiếp với ngân hàng, sau đó xóa Card Catalog và cashback rules.
- `V8__share_credit_limits_by_bank.sql`: chuyển hạn mức từ từng thẻ sang hạn mức dùng chung theo user và ngân hàng.

## Troubleshooting

- `JWT key ...`: đặt `JWT_SECRET` dài tối thiểu 32 byte.
- Flyway không kết nối: kiểm tra URL/user và MySQL health.
- Angular CLI từ chối Node: nâng đúng range ghi trong `package.json`.
- CORS/cookie: origin phải khớp chính xác và request refresh dùng credentials.

Các giả định chi tiết nằm trong `docs/architecture/assumptions.md`.


#Build image docker
docker build  -t kira2308/kira-bank-service:latest .\kira-bank-service
docker build  -t kira2308/kira-bank-ui:latest .\kira-bank-ui

docker push kira2308/kira-bank-service:latest
docker push kira2308/kira-bank-ui:latest
