# API

OpenAPI tương tác: `http://localhost:8080/swagger-ui.html`.

Các request tài chính quan trọng cần header `Idempotency-Key` là UUID do client tạo. Danh sách trả `{ data, meta }`; lỗi trả `{ timestamp, status, code, message, fieldErrors, path, traceId }`.

Nhóm chính: `/api/v1/auth`, `/api/v1/public`, `/api/v1/credit-cards`, `/api/v1/card-transactions`, `/api/v1/statements`, `/api/v1/discount-invoices`, `/api/v1/investment/accounts`, `/api/v1/investment/deposits`, `/api/v1/investment/tasks`, `/api/v1/investment/withdrawals` và ledger theo account.

## Thẻ tín dụng người dùng

`POST /api/v1/credit-cards` nhận `bankId` thay cho `cardCatalogId`. `bankId` phải trỏ tới một ngân hàng đang hoạt động. Response trả `bankId`, `bankName` và `bankLogoUrl`; thẻ người dùng không còn loại thẻ hoặc liên kết với Card Catalog. Khi tạo thẻ, `created_by` và `updated_by` được gán bằng user đang đăng nhập; khi cập nhật, chỉ `updated_by` thay đổi.

Response của `GET /api/v1/credit-cards` và `GET /api/v1/credit-cards/{id}` bổ sung trạng thái kỳ hiện tại qua các field `billingCycleId`, `statementDate`, `paymentDueDate`, `statementBalance`, `minimumPayment`, `billingStatus` và `billingVersion`. `billingStatus` có thể là `NOT_DUE`, `NEEDS_INPUT`, `UNPAID`, `OVERDUE` hoặc `PAID`.

`PUT /api/v1/credit-cards/{cardId}/billing-cycle` nhận:

```json
{
  "statementBalance": 12500000,
  "minimumPayment": 625000,
  "paymentStatus": "UNPAID",
  "version": 0
}
```

Hai số tiền phải dương và mức thanh toán tối thiểu không được vượt tổng dư nợ. `paymentStatus` chỉ nhận `UNPAID` hoặc `PAID`. Chọn `PAID` ghi một payment `COMPLETED` bằng toàn bộ dư nợ với reference/idempotency key xác định theo statement. Kỳ đã `PAID` không được sửa hoặc chuyển lại `UNPAID`; `version` dùng để phát hiện cập nhật đồng thời.

Job tạo kỳ hiện tại chạy theo `CARD_STATEMENT_JOB_CRON` và `CARD_STATEMENT_JOB_TIME_ZONE` (mặc định `00:05`, `Asia/Bangkok`). Job chỉ xử lý thẻ `ACTIVE`, không backfill tháng cũ và dựa trên unique `(user_card_id, statement_date)` để chạy lặp an toàn.

Public catalog chỉ còn `/api/v1/public/banks` và `/api/v1/public/mccs`. Các endpoint `/api/v1/public/cards` và `/api/v1/public/cashback-finder` đã được gỡ bỏ. Lịch sử cashback thực tế tại `cashback_records` vẫn được giữ nguyên.
