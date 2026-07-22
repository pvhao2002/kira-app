# Giả định kiến trúc

- VND là tiền tệ mặc định nhưng mọi bản ghi tiền đều giữ mã ISO 4217 riêng.
- Tỷ lệ được lưu dạng thập phân (`0.05` tương ứng 5%). Tiền làm tròn 4 chữ số với `HALF_UP`; sai số settlement mặc định là `0.01`.
- Access token tồn tại 15 phút và chỉ giữ trong memory của Angular. Refresh token 30 ngày nằm trong cookie `HttpOnly`, được rotation mỗi lần refresh; production phải bật cờ `Secure` tại reverse proxy/TLS.
- Kira Bank ghi nhận giao dịch đầu tư do người dùng khai báo, không kết nối hoặc giữ credential của website thứ ba.
- Một settlement chính duy nhất cho mỗi task. Sai sót sau settlement được xử lý bằng reversal/adjustment ledger, không sửa ledger cũ.
- Seed development được tạo khi `app.seed-development-users=true` và luôn tắt trong profile production.
- Chức năng quên mật khẩu có schema token và điểm mở rộng; gửi email cần mail provider của môi trường triển khai.

