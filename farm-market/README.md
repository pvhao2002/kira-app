# Farm Market (Đồi Nắng)

Nền tảng thương mại điện tử nhiều chi nhánh cho trang trại Đồi Nắng: bán trứng, thức ăn chăn nuôi, con giống và nội dung blog. Khách hàng đặt hàng và nhận giao từ chi nhánh gần nhất; nhân viên và quản trị viên quản lý đơn, kho, khuyến mãi theo chi nhánh.

> Trạng thái: mới khởi tạo. Hiện mới có bản mockup giao diện trong [`designs/Doi Nang Farm Mockups.html`](designs/Doi%20Nang%20Farm%20Mockups.html); chưa có mã nguồn backend/frontend.

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

## Docker Compose

```bash
docker compose up --build
```

UI: http://localhost:4201, API: http://localhost:8081, MySQL host port 3308. Compose chỉ chạy được sau khi tạo `farm-market-service` và `farm-market-ui`.

## Giấy phép

MIT, xem [LICENSE](LICENSE).
