# Quy tắc toàn vẹn tài chính

- Payment `COMPLETED` mới giảm remaining statement; không cho trả vượt dư nợ ngoài tolerance.
- Dư nợ thẻ dùng chung theo `user + bank` bằng `max(0, tổng remaining statement + offset mới nhất)`. Điều chỉnh balance không sửa statement, bắt buộc lý do, ghi append-only và dùng `balance_version` độc lập với version hạn mức.
- Kỳ sao kê tháng hiện tại được tạo tối đa một lần cho mỗi thẻ. Xác nhận `PAID` cho sao kê có dư nợ từ My cards luôn ghi payment toàn bộ bằng reference/idempotency key xác định và không cho đảo ngược.
- Kỳ sao kê 0 đồng được tự hoàn tất với minimum payment, paid amount và remaining amount bằng 0; không tạo payment 0 đồng.
- Payment thủ công và payment tự tạo khi xác nhận sao kê đã trả cùng dùng bảng `payments`; các thao tác phải giữ ownership, idempotency và audit fields.
- `investment_accounts` chỉ là hồ sơ nhận diện/liên hệ. Không thực hiện phép tính hoặc ghi nhận balance, capital, profit, reward, settlement hay ledger.
- `investment_account_transactions` chỉ là lịch sử độc lập. Amount luôn dương scale 4, currency phải khớp account; import không cập nhật `investment_accounts`.
- AI chỉ tạo staging item, không tự ghi transaction. Confidence dưới `0.80`, currency suy diễn, field thiếu hoặc dedup conflict đều yêu cầu người dùng review.
- Confirm chuẩn hóa và dedup lại ở backend. Chỉ cho nâng `PENDING` lên terminal status; không downgrade terminal và không tự đổi type/amount/currency/external ID của transaction đã có.
- Confirm từng item chạy độc lập, dùng optimistic version và unique key để idempotent/concurrency-safe. `SAVE_AS_NEW` chỉ tạo fingerprint phân biệt bằng item UUID; external ID đã tồn tại vẫn không được nhân đôi.
- Ảnh nguồn được purge khỏi R2 sau 30 ngày kể từ batch terminal; metadata/hash/source audit được giữ và content endpoint trả `410 ATTACHMENT_PURGED`.
- Nhập sao kê thẻ bằng AI chỉ tạo bản nháp trên `card_statement_imports`; không có statement/giao dịch nào được ghi trước khi người dùng confirm. Confirm khóa import, kiểm tra `version`, idempotent (lần hai trả kết quả cũ).
- Confirm chỉ ghi đè số tổng của kỳ cùng tháng khi kỳ đó `NEEDS_INPUT`/`OPEN`/`UNPAID`, `paidAmount = 0` và chưa có payment; nếu không, giữ nguyên số tổng (`totalsApplied=false`) và chỉ thêm giao dịch. Không bao giờ tạo hay sửa payment.
- `card_transactions` dedup theo SHA-256 của thẻ + ngày + số tiền + loại + mô tả chuẩn hóa + thứ tự xuất hiện; giao dịch ghi tay dedup theo `Idempotency-Key`. Khi confirm sao kê, giao dịch ghi tay chưa gắn sao kê trong kỳ đó được xóa mềm để không tính trùng trần cashback/hạn mức.
- Cashback là ước tính hiển thị (`statements.expected_cashback`, tiến độ, gợi ý thẻ), dùng `BigDecimal` scale 4 `HALF_UP`, không tạo ledger hay reward. Ảnh sao kê purge khỏi R2 sau 30 ngày kể từ khi import ở trạng thái cuối.
