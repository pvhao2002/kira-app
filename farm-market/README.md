# Farm Market (Đồi Nắng)

Nền tảng thương mại điện tử nhiều chi nhánh cho trang trại Đồi Nắng: bán trứng, thức ăn chăn nuôi, con giống và nội dung blog. Khách hàng đặt hàng và nhận giao từ chi nhánh gần nhất; nhân viên và quản trị viên quản lý đơn, kho, khuyến mãi theo chi nhánh.

> Trạng thái: `farm-market-ui` (Angular 22) dựng đủ các màn hình của mockup [`designs/Doi Nang Farm Mockups.html`](designs/Doi%20Nang%20Farm%20Mockups.html) và đã nối với `farm-market-service` (Spring Boot, `/api/v1`, MySQL). Đã kiểm tra thủ công với MySQL: đăng nhập 4 vai trò (khách, nhân viên, quản lý, quản trị), xem sản phẩm, yêu thích, đặt hàng, xử lý đơn, hủy đơn hoàn điểm, đổi thưởng, đánh giá, sửa hồ sơ và đổi màu chi nhánh. Backend có 32 test đơn vị (`./mvnw.cmd test`, không cần DB) và 30 test tích hợp `*IT` chạy trên MySQL thật qua Testcontainers (`$env:TESTCONTAINERS_RYUK_DISABLED='true'; .\mvnw.cmd verify` trong `farm-market-service`, cần Docker đang chạy và image `mysql:8.0` có sẵn). Chưa có: cổng thanh toán ví/thẻ thật (chuyển khoản VietQR đã có, nhân viên đối soát thủ công), mã dự phòng/QR cho OTP, UI test; `docker compose build` chưa được kiểm tra vì Docker Hub từ chối đăng nhập trên máy dev (cần `docker login`).
>
> Chạy thử cục bộ:
> 1. `docker compose up -d mysql` (cổng 3308).
> 2. `cd farm-market-service`, đặt biến môi trường `DB_URL=jdbc:mysql://localhost:3308/farm_market?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`, `DB_USERNAME=farm_market`, `DB_PASSWORD=change-me`, `JWT_SECRET` (≥ 32 ký tự), `APP_SEED_DEVELOPMENT_USERS=true`, `SERVER_PORT=8081`, rồi `./mvnw.cmd spring-boot:run`.
> 3. `cd farm-market-ui && npm install --legacy-peer-deps && npm start` (cần Node ≥ 22.22.3), mở http://localhost:4201.
>
> Tài khoản demo (mật khẩu `Doinang@123`, chọn nhanh trên trang đăng nhập): khách hàng `lan.nguyen@gmail.com`, nhân viên `minh.tran@doinang.vn`, quản lý `ngoc.le@doinang.vn`, quản trị `admin@doinang.vn`. Nhân viên/quản lý/quản trị phải qua bước TOTP thật (RFC 6238, SHA1, 6 số, 30 giây, chấp nhận ±1 bước, mỗi mã chỉ dùng một lần). Khi `APP_SEED_DEVELOPMENT_USERS=true`, 3 tài khoản này được đăng ký sẵn với khóa dev chung `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (đổi bằng `APP_SEED_DEVELOPMENT_TOTP_SECRET`): thêm khóa này vào ứng dụng xác thực (nhập thủ công, loại theo thời gian) hoặc chạy `node farm-market-service/totp.js` để in mã hiện tại. Khóa mã hóa bí mật TOTP trong DB: `TOTP_ENCRYPTION_KEY` (>= 32 ký tự, bắt buộc đặt ngoài môi trường dev). Admin đặt lại OTP cho một người bằng `POST /api/v1/admin/users/{id}/otp/reset`. `farm-market-service/smoke.sh` chạy một luồng kiểm tra nhanh qua API.

## Công nghệ dự kiến (theo `kira-bank`)

- `farm-market-service`: Java 25, Spring Boot 3.5, Security/JWT, JPA, Flyway, MySQL 8, OpenAPI. Modular monolith theo nghiệp vụ.
- `farm-market-ui`: Angular standalone, strict TypeScript, Signals, lazy routes, responsive.
- `docs`: kiến trúc, ERD, business rules, API, deployment.
- `infrastructure`: cấu hình triển khai. `scripts`: script vận hành (mặc định dry-run).

## Phạm vi sản phẩm (từ mockup)

Khách hàng: `/products`, `/products/:slug`, `/checkout`, `/login`, `/account` (đơn hàng, sổ địa chỉ, yêu thích, điểm thưởng, đánh giá).

Quản trị: `/admin` (dashboard), `/admin/orders`, `/admin/products`, `/admin/inventory`, `/admin/customers`, `/admin/promotions`, `/admin/branches`, `/admin/branches/theme`.

Vai trò: Khách hàng, Nhân viên (chỉ thấy chi nhánh được phân quyền), Quản trị viên (tất cả chi nhánh, cấu hình màu và phân quyền).

Thanh toán: COD, chuyển khoản VietQR, ví MoMo/ZaloPay, thẻ Visa/Napas. Điểm thưởng: 1 điểm = 100đ, hạng thành viên (Vàng, Kim cương).

## Cấu hình

Sao chép `.env.example` thành `.env` và đổi toàn bộ secret.

### Quà đổi điểm (phần thưởng)

Danh mục quà nằm trong `farm-market-service/src/main/resources/application.yml`, mục `app.loyalty.rewards` (id, name, description, points-cost, type `PERCENT`/`FIXED`/`FREE_SHIP`, value, min-order, valid-days). **Đây là quyết định kinh doanh: chỉnh trong cấu hình, không sửa code.** Id phải duy nhất và chi phí điểm phải dương, nếu sai ứng dụng sẽ không khởi động. API `/loyalty/rewards` giữ nguyên. Đổi cấu hình chỉ áp dụng cho lượt đổi mới; voucher đã đổi giữ nguyên giá trị cũ.

### Thanh toán chuyển khoản (VietQR, không cần cổng thanh toán)

Đặt `VIETQR_BANK_BIN` (hoặc `BANK_CODE`), `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME` (tùy chọn `BANK_NAME` để hiển thị). Khi đủ cả ba, đơn `BANK_TRANSFER` trả thêm khối `payment` (`qrUrl` là ảnh `img.vietqr.io` công khai, không cần API key; nội dung chuyển khoản là mã đơn) và trang đặt hàng thành công hiển thị mã QR. Nếu thiếu, không có trường QR và giao diện chỉ hiển thị hướng dẫn chuyển khoản. Nhân viên/quản lý/admin xác nhận tiền về bằng `POST /api/v1/admin/orders/{code}/payment {status: PAID|UNPAID, note?}` (theo chi nhánh, idempotent, đơn đã hủy trả 409, đơn COD tự thành PAID khi giao). Ví điện tử và thẻ chưa có cổng thanh toán: nhân viên xử lý thủ công và cũng xác nhận bằng endpoint này.

## Docker Compose

```bash
docker compose up --build
```

UI: http://localhost:4201, API: http://localhost:8081, MySQL host port 3308. Compose chỉ chạy được sau khi tạo `farm-market-service` và `farm-market-ui`.

## Giấy phép

MIT, xem [LICENSE](LICENSE).
