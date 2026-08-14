# Quy tắc toàn vẹn tài chính

- Payment `COMPLETED` mới giảm remaining statement; không cho trả vượt dư nợ ngoài tolerance.
- Kỳ sao kê tháng hiện tại được tạo tối đa một lần cho mỗi thẻ. Xác nhận `PAID` từ My cards luôn ghi payment toàn bộ dư nợ bằng reference/idempotency key xác định và không cho đảo ngược.
- Profit hóa đơn = cashback - service discount - additional fee.
- Deposit chỉ tăng capital khi completed và không tăng profit/reward.
- Allocation chuyển available capital sang locked capital.
- Settlement bắt buộc `totalReceived = capitalReturned + profit + reward - fee` và ghi các ledger entry riêng.
- Withdrawal reserve loại tiền khỏi available; completed giảm balance, failed/cancelled phải reversal reserve.
- Ledger append-only, khóa duy nhất `(account, idempotency_key)`.
