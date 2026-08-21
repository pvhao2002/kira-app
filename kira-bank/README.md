# Kira Bank

Kira Bank là ứng dụng quản lý thẻ tín dụng, sao kê, thanh toán, hồ sơ tài khoản đầu tư và lịch sử giao dịch đầu tư nhập từ ảnh qua AI. Lịch sử đầu tư độc lập, không tính balance/capital và không tạo ledger.

## Công nghệ và cấu trúc

- `kira-bank-service`: Java 25, Spring Boot 3.5, Security/JWT, JPA, Flyway, MySQL, OpenAPI.
- `kira-bank-ui`: Angular 22 standalone, strict TypeScript, Signals, lazy routes, responsive light/dark UI.
- `docs`: kiến trúc, ERD, business rules, API và production deployment.

Backend là modular monolith. Dữ liệu thẻ/sao kê/thanh toán độc lập với hồ sơ tài khoản đầu tư; dashboard nghiệp vụ chỉ tổng hợp thẻ tín dụng.

## Yêu cầu

Java 25, Node `^22.22.3` hoặc `^24.15.0` hoặc `>=26`, npm 8+, Docker Desktop (nếu chạy compose) và MySQL 8 khi chạy thủ công.

## Cấu hình

Sao chép `.env.example` thành `.env` và đổi toàn bộ secret. Cloudflare Account ID, Workers AI token/model và R2 access key/bucket được quản lý động tại `/app/admin/cloudflare-accounts`; chúng không còn lấy từ môi trường. `AI_CREDENTIAL_ENCRYPTION_KEY` là master key Base64 32 byte duy nhất phải cấu hình ngoài database. Cron, timeout và retry của AI vẫn là cấu hình vận hành.

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
- Public: `/api/v1/public/banks`.
- Credit card: `/credit-cards`, `/statements`, `/statements/{id}/payments`, `/payments`, `/dashboards/credit-cards`.
- Investment: CRUD hồ sơ tại `/investment/accounts`, import tại `/investment/accounts/{id}/transaction-imports` và lịch sử tại `/investment/accounts/{id}/transactions`.
- Shared: `/attachments` lưu ảnh nguồn; scheduler AI xử lý tối đa 3 ảnh/request mỗi 3 giờ, luôn chờ người dùng review/confirm.
- Admin Cloudflare: `/admin/cloudflare-accounts` quản lý Workers AI failover và R2 primary động.

## Migration

- `V1__initial_schema.sql`: 33 bảng identity, Flow 1, Flow 2 và shared; foreign key, unique/check constraint và index.
- `V2__seed_public_catalog.sql`: dữ liệu seed lịch sử. Catalog MCC, service provider và investment platform được xóa ở V13. User development được hash và tạo bởi application runner, không hard-code vào production migration.
- `V6__link_user_credit_cards_to_banks.sql`: chuyển thẻ người dùng sang liên kết trực tiếp với ngân hàng, sau đó xóa Card Catalog và cashback rules.
- `V8__share_credit_limits_by_bank.sql`: chuyển hạn mức từ từng thẻ sang hạn mức dùng chung theo user và ngân hàng.
- `V13__remove_legacy_financial_tables.sql`: hard-delete 13 bảng nghiệp vụ cũ và chuyển `investment_accounts` thành hồ sơ tối giản. Cần backup dữ liệu trước deploy nếu muốn lưu lịch sử.
- `V14__create_investment_transaction_import.sql`: tạo transaction history, batch/file/item staging, source links, dedup constraints và metadata retention cho attachment. Không phục hồi balance/ledger đã xóa.
- `V19__unify_cloudflare_accounts_and_r2.sql`: hợp nhất cấu hình Workers AI/R2 và gắn attachment với đúng R2 account.

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
