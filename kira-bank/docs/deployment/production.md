# Triển khai production

Đặt secret trong secret manager, bật TLS, đổi refresh cookie sang `Secure`, tắt development seed, dùng object storage/virus scanning cho attachment và vận hành MySQL backup/PITR. Chạy Flyway từ một backend instance trước khi scale ngang.

## Bảo mật

- **CORS**: `CORS_ALLOWED_ORIGINS` chỉ liệt kê đúng origin của web client (`https://app.example.com`, phân tách bằng dấu phẩy). Không chấp nhận `*`, path hay query; service từ chối khởi động nếu cấu hình sai. CORS chỉ áp dụng cho `/api/**`.
- **Rate-limit đăng nhập**: `POST /api/v1/auth/login` và `/api/v1/auth/mobile/login` giới hạn 20 lần/5 phút mỗi IP và 5 lần sai/15 phút mỗi email (`LOGIN_RATE_LIMIT_*`). IP client lấy qua `LOGIN_VISIT_TRUSTED_PROXIES`, nên phải khai báo đúng địa chỉ reverse proxy. Bộ đếm nằm trong bộ nhớ từng instance.
- **Swagger/OpenAPI**: đặt `API_DOCS_ENABLED=false` ở production.
- **Lỗi trả về client**: chỉ gồm `code`, message nghiệp vụ và `traceId`; stack trace, SQL và tên class chỉ nằm trong log server (tra theo `traceId`).
- **Security header**: backend và nginx của `kira-bank-ui` gửi CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` và HSTS (chỉ có hiệu lực qua HTTPS).
- **Upload**: server kiểm tra magic bytes, loại file và dung lượng cho từng endpoint (tối đa 10 MB/file, 55 MB/request); tên file gốc được làm sạch trước khi lưu.
- **Secret**: frontend không chứa secret; mọi credential (JWT, DB, R2, AI, Mapbox) chỉ cấu hình ở backend qua biến môi trường.
