# API

OpenAPI tương tác: `http://localhost:8080/swagger-ui.html`.

Các request tài chính quan trọng cần header `Idempotency-Key` là UUID do client tạo. Danh sách trả `{ data, meta }`; lỗi trả `{ timestamp, status, code, message, fieldErrors, path, traceId }`.

Nhóm chính: `/api/v1/auth`, `/api/v1/public`, `/api/v1/credit-cards`, `/api/v1/card-transactions`, `/api/v1/statements`, `/api/v1/discount-invoices`, `/api/v1/investment/accounts`, `/api/v1/investment/deposits`, `/api/v1/investment/tasks`, `/api/v1/investment/withdrawals` và ledger theo account.

## Thẻ tín dụng người dùng

`POST /api/v1/credit-cards` nhận `bankId` và `creditLimit`. `bankId` phải trỏ tới một ngân hàng đang hoạt động. Hạn mức được lưu theo cặp `user + bank`: thẻ đầu tiên tạo hạn mức chung, còn thẻ tiếp theo của cùng ngân hàng phải gửi đúng hạn mức đang có. Response trả `bankId`, `bankName`, `bankLogoUrl`, hạn mức chung qua `creditLimit` và phiên bản `creditLimitVersion`. Khi tạo thẻ, `created_by` và `updated_by` được gán bằng user đang đăng nhập; khi cập nhật, chỉ `updated_by` thay đổi.

`GET /api/v1/credit-card-bank-limits` trả các hạn mức chung của user. `PUT /api/v1/credit-card-bank-limits/{bankId}` nhận `{ "creditLimit": 50000000, "version": 0 }`; version cũ trả `409 CREDIT_LIMIT_VERSION_CONFLICT`. `PUT /api/v1/credit-cards/{id}` cũng nhận `creditLimitVersion` và cập nhật thẻ cùng hạn mức ngân hàng trong một transaction.

Response của `GET /api/v1/credit-cards` và `GET /api/v1/credit-cards/{id}` bổ sung `currentBalance` cùng trạng thái kỳ hiện tại qua các field `billingCycleId`, `statementDate`, `paymentDueDate`, `statementBalance`, `minimumPayment`, `billingStatus` và `billingVersion`. `currentBalance` là tổng `remaining_amount` của tất cả sao kê còn nợ thuộc mọi thẻ cùng user và ngân hàng, nên các thẻ cùng bank trả cùng một số dư hiện tại; `billingStatus` vẫn thuộc kỳ sao kê riêng của từng thẻ và có thể là `NOT_DUE`, `NEEDS_INPUT`, `UNPAID`, `OVERDUE` hoặc `PAID`.

## Tìm kiếm toàn cục

Angular gọi song song ba API domain hiện có; không có endpoint tìm kiếm tổng hợp. `GET /api/v1/credit-cards`, `GET /api/v1/investment/accounts` và `GET /api/v1/public/banks` nhận query parameter `search` tùy chọn, đồng thời vẫn nhận `page` và `size` như trước.

- Thẻ tìm không phân biệt hoa thường theo nickname, bốn số cuối, code/tên ngắn/tên đầy đủ của ngân hàng; kết quả luôn giới hạn theo user đăng nhập và bỏ dữ liệu soft-delete.
- Tài khoản đầu tư tìm theo account code, account name, external code, username hoặc email; kết quả luôn giới hạn theo user đăng nhập và bỏ dữ liệu soft-delete.
- Ngân hàng tìm theo code, tên ngắn hoặc tên đầy đủ; chỉ trả ngân hàng active và chưa bị xóa.

`PUT /api/v1/credit-cards/{cardId}/billing-cycle` nhận:

```json
{
  "billingCycleId": 42,
  "statementBalance": 12500000,
  "minimumPayment": 625000,
  "paymentStatus": "UNPAID",
  "version": 0
}
```

Hai số tiền phải dương và mức thanh toán tối thiểu không được vượt tổng dư nợ. `paymentStatus` chỉ nhận `UNPAID` hoặc `PAID`. `billingCycleId` xác định đúng kỳ đang hiển thị và có thể là `null` khi job chưa tạo kỳ; khi đó backend chỉ tự tạo kỳ tháng hiện tại nếu đã tới ngày sao kê. Chọn `PAID` ghi một payment `COMPLETED` bằng toàn bộ dư nợ với reference/idempotency key xác định theo statement. Kỳ đã `PAID` không được sửa hoặc chuyển lại `UNPAID`; `version` dùng để phát hiện cập nhật đồng thời.

My cards ưu tiên kỳ chưa thanh toán có `statementDate` mới nhất trên toàn bộ lịch sử, sau đó mới dùng kỳ của tháng hiện tại. Vì vậy kỳ tháng trước vẫn trả `UNPAID` hoặc `OVERDUE` và tiếp tục được cảnh báo cho tới khi thanh toán.

Job tạo kỳ hiện tại chạy theo `CARD_STATEMENT_JOB_CRON` và `CARD_STATEMENT_JOB_TIME_ZONE` (mặc định `00:05`, `Asia/Bangkok`). Job chỉ xử lý thẻ `ACTIVE`, không backfill tháng cũ và dựa trên unique `(user_card_id, statement_date)` để chạy lặp an toàn.

## Dashboard dư nợ thẻ

`GET /api/v1/dashboards/credit-cards` trả snapshot tổng hợp dư nợ của mọi thẻ chưa bị xóa. Response gồm `totalCreditLimit`, `totalStatementDebt`, `currentBalance`, `availableCredit`, `utilizationRate`, `currency` và danh sách `banks`; mỗi ngân hàng chứa đúng một hạn mức chung, `creditLimitVersion`, tổng dư nợ và danh sách chi tiết từng thẻ.

`statementDebt` cộng `statement_balance` của các kỳ còn nợ, còn `currentBalance` cộng phần `remaining_amount` thực tế sau payment. Kỳ `PAID` hoặc `CANCELLED` không được tính. Tổng hạn mức và current balance đều có grain theo ngân hàng; dòng thẻ con chỉ giữ chi tiết dư nợ sao kê và hiển thị current balance là dùng chung để tránh cộng lặp. `availableCredit` có thể âm khi vượt hạn mức và `utilizationRate` có thể lớn hơn `100`.

Public catalog chỉ còn `/api/v1/public/banks` và `/api/v1/public/mccs`. Các endpoint `/api/v1/public/cards` và `/api/v1/public/cashback-finder` đã được gỡ bỏ. Lịch sử cashback thực tế tại `cashback_records` vẫn được giữ nguyên.
