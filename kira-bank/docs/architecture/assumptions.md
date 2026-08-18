# Giả định kiến trúc

- VND là tiền tệ mặc định; các bản ghi tiền còn lại giữ mã ISO 4217 riêng.
- Access token tồn tại 15 phút và chỉ giữ trong memory của Angular. Refresh token 30 ngày nằm trong cookie `HttpOnly`, được rotation mỗi lần refresh; production phải bật cờ `Secure` tại reverse proxy/TLS.
- Investment account chỉ là hồ sơ do người dùng khai báo. Theo lựa chọn sản phẩm hiện tại, hồ sơ vẫn giữ `accountPassword`; ứng dụng không tự kết nối website thứ ba.
- Investment Transaction Import dùng schema AI version 2. Kết quả ảnh trùng chỉ tái sử dụng trong cùng user và cùng schema version; không chia sẻ hash, file hoặc kết quả AI chéo user.
- Scheduler mặc định chạy mỗi 3 giờ, tối đa 3 ảnh/request; model cần vision và structured output theo [Cloudflare model docs](https://developers.cloudflare.com/workers-ai/models/kimi-k2.7-code/) và [JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/). Nếu AI chưa cấu hình, create batch trả 503 thay vì để queue treo.
- Mọi account thuộc user, kể cả `INACTIVE`/`CLOSED`, được import lịch sử. Người dùng luôn review trước confirm; transaction không tính balance hoặc ledger.
- Seed development được tạo khi `app.seed-development-users=true` và luôn tắt trong profile production.
- Chức năng quên mật khẩu có schema token và điểm mở rộng; gửi email cần mail provider của môi trường triển khai.
