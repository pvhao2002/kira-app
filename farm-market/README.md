# Farm Market (Kira Farm)

Nền tảng thương mại điện tử nhiều chi nhánh cho trang trại Kira Farm: bán trứng, thức ăn chăn nuôi, con giống và nội dung blog. Khách hàng đặt hàng và nhận giao từ chi nhánh gần nhất; nhân viên và quản trị viên quản lý đơn, kho, khuyến mãi theo chi nhánh.

> Trạng thái: `farm-market-ui` (Angular 22) dựng đủ các màn hình của mockup [`designs/Kira Farm Mockups.html`](designs/Kira%20Farm%20Mockups.html) và đã nối với `farm-market-service` (Spring Boot, `/api/v1`, MySQL). Đã kiểm tra thủ công với MySQL: đăng nhập 4 vai trò (khách, nhân viên, quản lý, quản trị), xem sản phẩm, yêu thích, đặt hàng, xử lý đơn, hủy đơn hoàn điểm, đổi thưởng, đánh giá, sửa hồ sơ và đổi màu chi nhánh. Đã thêm tài khoản nhân viên/quản trị đầu tiên, quên/đổi mật khẩu và tải ảnh lên (xem các mục bên dưới; UI của ba tính năng này chưa được build hay kiểm tra bằng mắt). Backend có test đơn vị (`./mvnw.cmd test`, không cần DB) và test tích hợp `*IT` chạy trên MySQL thật qua Testcontainers (`$env:TESTCONTAINERS_RYUK_DISABLED='true'; .\mvnw.cmd verify` trong `farm-market-service`, cần Docker đang chạy và image `mysql:8.0` có sẵn). Chưa có: cổng thanh toán ví/thẻ thật (chuyển khoản VietQR đã có, nhân viên đối soát thủ công), mã dự phòng/QR cho OTP, UI test; `docker compose build` chưa được kiểm tra vì Docker Hub từ chối đăng nhập trên máy dev (cần `docker login`).
>
> Chạy thử cục bộ:
> 1. `docker compose up -d mysql` (cổng 3308).
> 2. `cd farm-market-service`, đặt biến môi trường `DB_URL=jdbc:mysql://localhost:3308/farm_market?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`, `DB_USERNAME=farm_market`, `DB_PASSWORD=change-me`, `JWT_SECRET` (≥ 32 ký tự), `APP_SEED_DEVELOPMENT_USERS=true`, `SERVER_PORT=8081`, rồi `./mvnw.cmd spring-boot:run`.
> 3. `cd farm-market-ui && npm install --legacy-peer-deps && npm start` (cần Node ≥ 22.22.3), mở http://localhost:4201.
>
> Lưu ý đổi thương hiệu sang Kira Farm: mã đơn mới có tiền tố `KF-` (đơn cũ giữ `DN-`), email dev đổi sang `@kirafarm.vn` và mật khẩu dev sang `KiraFarm@123`. Nếu database dev cũ còn tài khoản và mật khẩu cũ, chạy `docker compose down -v` để tạo lại.
>
> Tài khoản demo (mật khẩu `KiraFarm@123`, chọn nhanh trên trang đăng nhập): khách hàng `lan.nguyen@gmail.com`, nhân viên `minh.tran@kirafarm.vn`, quản lý `ngoc.le@kirafarm.vn`, quản trị `admin@kirafarm.vn`. Nhân viên/quản lý/quản trị phải qua bước TOTP thật (RFC 6238, SHA1, 6 số, 30 giây, chấp nhận ±1 bước, mỗi mã chỉ dùng một lần). Khi `APP_SEED_DEVELOPMENT_USERS=true`, 3 tài khoản này được đăng ký sẵn với khóa dev chung `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (đổi bằng `APP_SEED_DEVELOPMENT_TOTP_SECRET`): thêm khóa này vào ứng dụng xác thực (nhập thủ công, loại theo thời gian) hoặc chạy `node farm-market-service/totp.js` để in mã hiện tại. Khóa mã hóa bí mật TOTP trong DB: `TOTP_ENCRYPTION_KEY` (>= 32 ký tự, bắt buộc đặt ngoài môi trường dev). Admin đặt lại OTP cho một người bằng `POST /api/v1/admin/users/{id}/otp/reset`. `farm-market-service/smoke.sh` chạy một luồng kiểm tra nhanh qua API.

> Quản trị viên đầu tiên (không dùng dữ liệu dev): đặt `APP_BOOTSTRAP_ADMIN_EMAIL` và `APP_BOOTSTRAP_ADMIN_PASSWORD` (>= 12 ký tự, tùy chọn `APP_BOOTSTRAP_ADMIN_NAME`). Khi khởi động, nếu CHƯA có admin nào và email chưa tồn tại thì tạo admin; thiếu một trong hai biến thì bỏ qua, không bao giờ ghi đè người dùng có sẵn, không ghi log email/mật khẩu. Admin tự đăng ký OTP ở lần đăng nhập đầu, rồi bỏ mật khẩu khỏi môi trường. Sau đó admin tạo nhân viên/quản lý trong `/admin/users` (`POST /api/v1/admin/users`: họ tên, email, mật khẩu tạm, vai trò, chi nhánh) và đổi vai trò bằng `PUT /api/v1/admin/users/{id}/role {role}` (không tự đổi vai trò của mình, luôn còn >= 1 admin đang hoạt động, đổi vai trò thu hồi mọi phiên của người đó).

> Quên/đổi mật khẩu: `POST /api/v1/auth/password/forgot {email}` luôn trả 202 (kể cả email lạ), giới hạn 5 lần/15 phút theo email (429 `RESET_RATE_LIMITED`, bộ đếm trong bộ nhớ từng instance). Token một lần, hiệu lực 30 phút (`APP_PASSWORD_RESET_TTL`), chỉ lưu SHA-256 (Flyway V7), chỉ giữ token mới nhất mỗi người. Liên kết là `APP_PUBLIC_URL/reset-password#token=...` (token nằm ở fragment). Chưa có SMTP: với profile `dev` (`SPRING_PROFILES_ACTIVE=dev`) liên kết được ghi vào log; ngoài dev chỉ ghi cảnh báo chưa cấu hình mail và KHÔNG ghi token. `POST /api/v1/auth/password/reset {token, newPassword}` đổi mật khẩu và thu hồi mọi phiên. `POST /api/v1/auth/password/change {currentPassword, newPassword}` (đã đăng nhập) thu hồi các phiên khác, giữ phiên hiện tại (nhận biết qua cookie `farm_refresh`). UI: `/forgot-password`, `/reset-password`, form đổi mật khẩu ở `/account`.

> Ảnh: lưu trên đĩa cục bộ tại `APP_UPLOAD_DIR` (mặc định `./uploads`; trong docker compose là volume `farm-market-uploads` gắn vào `/data/uploads`), phục vụ công khai qua `GET /api/v1/files/{uuid}.{jpg|png|webp}` (controller tự stream, chống path traversal, `nosniff`, cache dài vì tên bất biến). Giới hạn: một instance duy nhất (đĩa cục bộ), file mồ côi chưa được dọn. `POST /api/v1/admin/media/products` (quản lý/admin) và `POST /api/v1/media/reviews` (khách đã có đơn DELIVERED) nhận multipart `file`, tối đa 5MB, chỉ JPEG/PNG/WebP nhận diện bằng magic bytes (không SVG; bỏ qua tên file và Content-Type của client), tên ngẫu nhiên, 20 lần tải/10 phút mỗi người; trả `{url}`. `photoUrl` của đánh giá và `imageUrl` của sản phẩm chỉ nhận URL do hệ thống sinh (không còn nhận liên kết `https://` bên ngoài). `APP_MEDIA_PUBLIC_BASE_URL` (tùy chọn) thêm origin vào URL trả về.

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

## Ứng dụng desktop cho admin (Tauri v2)

`farm-market-admin-desktop/` là vỏ desktop mỏng (macOS / Linux / Windows) mở giao diện đã triển khai tại `<FARM_ADMIN_URL>/admin`; không sao chép mã UI và không đổi API. Đặt `FARM_ADMIN_URL` (xem `.env.example`) rồi chạy `npm install && npm run build` trên từng hệ điều hành, hoặc dùng workflow `.github/workflows/farm-admin-desktop.yml`. Bản dựng chưa ký (macOS Gatekeeper / Windows SmartScreen sẽ cảnh báo). Chi tiết: `farm-market-admin-desktop/AGENTS.override.md`.

## Giấy phép

MIT, xem [LICENSE](LICENSE).
