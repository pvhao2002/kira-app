# Quy tắc toàn vẹn tài chính

- Payment `COMPLETED` mới giảm remaining statement; không cho trả vượt dư nợ ngoài tolerance.
- Dư nợ thẻ dùng chung theo `user + bank` bằng `max(0, tổng remaining statement + offset mới nhất)`. Điều chỉnh balance không sửa statement, bắt buộc lý do, ghi append-only và dùng `balance_version` độc lập với version hạn mức.
- Kỳ sao kê tháng hiện tại được tạo tối đa một lần cho mỗi thẻ. Xác nhận `PAID` cho sao kê có dư nợ từ My cards luôn ghi payment toàn bộ bằng reference/idempotency key xác định và không cho đảo ngược.
- Kỳ sao kê 0 đồng được tự hoàn tất với minimum payment, paid amount và remaining amount bằng 0; không tạo payment 0 đồng.
- Profit hóa đơn = cashback - service discount - additional fee.
- Deposit chỉ tăng capital khi completed và không tăng profit/reward.
- Allocation chuyển available capital sang locked capital.
- Settlement bắt buộc `totalReceived = capitalReturned + profit + reward - fee` và ghi các ledger entry riêng.
- Withdrawal reserve loại tiền khỏi available; completed giảm balance, failed/cancelled phải reversal reserve.
- Ledger append-only, khóa duy nhất `(account, idempotency_key)`.
