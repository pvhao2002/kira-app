# API

OpenAPI tương tác: `http://localhost:8080/swagger-ui.html`.

Các request tài chính quan trọng cần header `Idempotency-Key` là UUID do client tạo. Danh sách trả `{ data, meta }`; lỗi trả `{ timestamp, status, code, message, fieldErrors, path, traceId }`.

Nhóm chính: `/api/v1/auth`, `/api/v1/public/banks`, `/api/v1/credit-cards`, `/api/v1/statements`, `/api/v1/payments`, `/api/v1/dashboards/credit-cards`, `/api/v1/investment/accounts` và `/api/v1/attachments`.

## Thẻ tín dụng người dùng

`POST /api/v1/credit-cards` nhận `bankId`, `cardType` và `creditLimit`. `cardType` là tên loại thẻ tự nhập, bắt buộc và tối đa 150 ký tự. `bankId` phải trỏ tới một ngân hàng đang hoạt động. Hạn mức được lưu theo cặp `user + bank`: thẻ đầu tiên tạo hạn mức chung, còn thẻ tiếp theo của cùng ngân hàng phải gửi đúng hạn mức đang có. Response trả `bankId`, `bankName`, `bankLogoUrl`, `cardType`, hạn mức chung qua `creditLimit` và phiên bản `creditLimitVersion`. Khi tạo thẻ, `created_by` và `updated_by` được gán bằng user đang đăng nhập; khi cập nhật, chỉ `updated_by` thay đổi. Dữ liệu cũ có thể trả `cardType: null`, nhưng mọi request tạo hoặc cập nhật mới đều phải cung cấp giá trị.

`GET /api/v1/credit-card-bank-limits` trả các hạn mức chung của user. `PUT /api/v1/credit-card-bank-limits/{bankId}` nhận `{ "creditLimit": 50000000, "version": 0 }`; version cũ trả `409 CREDIT_LIMIT_VERSION_CONFLICT`. `PUT /api/v1/credit-cards/{id}` cũng nhận `creditLimitVersion` và cập nhật thẻ cùng hạn mức ngân hàng trong một transaction.

Response của `GET /api/v1/credit-cards` và `GET /api/v1/credit-cards/{id}` bổ sung `currentBalance`, `balanceVersion` cùng trạng thái kỳ hiện tại qua các field `billingCycleId`, `statementDate`, `paymentDueDate`, `statementBalance`, `minimumPayment`, `billingStatus` và `billingVersion`. `currentBalance` có grain theo `user + bank`, nên các thẻ cùng bank trả cùng một số dư hiện tại; `billingStatus` vẫn thuộc kỳ sao kê riêng của từng thẻ và có thể là `NOT_DUE`, `NEEDS_INPUT`, `UNPAID`, `OVERDUE` hoặc `PAID`.

`PUT /api/v1/credit-card-bank-balances/{bankId}` cho phép điều chỉnh dư nợ chung mà không sửa sao kê:

```json
{
  "currentBalance": 12000000,
  "reason": "Đối soát theo ứng dụng ngân hàng",
  "version": 0
}
```

`currentBalance` phải từ `0`, tối đa 15 chữ số nguyên và 4 chữ số thập phân; `reason` bắt buộc, tối đa 500 ký tự. Backend khóa aggregate `user + bank`, từ chối version cũ bằng `409 BANK_BALANCE_VERSION_CONFLICT`, lưu adjustment bất biến và tăng `balanceVersion` riêng mà không tăng `creditLimitVersion`. Nhập lại đúng balance đang hiển thị trả thành công nhưng không tạo adjustment hoặc tăng version. Response trả bank, `previousBalance`, `currentBalance`, `adjustmentAmount`, currency và `balanceVersion`.

Dư nợ gốc là tổng `remaining_amount` của các sao kê còn nợ. Adjustment mới nhất lưu offset bằng balance được nhập trừ dư nợ gốc tại thời điểm cập nhật; số hiển thị sau đó là `max(0, dư nợ gốc hiện tại + offset mới nhất)`. Vì vậy payment hoặc thay đổi sao kê của bất kỳ thẻ nào cùng bank vẫn làm số dư dùng chung thay đổi, còn số dư không hiển thị âm.

## Tìm kiếm toàn cục

Angular gọi song song ba API domain hiện có; không có endpoint tìm kiếm tổng hợp. `GET /api/v1/credit-cards`, `GET /api/v1/investment/accounts` và `GET /api/v1/public/banks` nhận query parameter `search` tùy chọn, đồng thời vẫn nhận `page` và `size` như trước.

- Thẻ tìm không phân biệt hoa thường theo loại thẻ, nickname, bốn số cuối, code/tên ngắn/tên đầy đủ của ngân hàng; kết quả luôn giới hạn theo user đăng nhập và bỏ dữ liệu soft-delete.
- Tài khoản đầu tư tìm theo account code, account name, external code, username hoặc email; kết quả luôn giới hạn theo user đăng nhập và bỏ dữ liệu soft-delete.
- Ngân hàng tìm theo code, tên ngắn hoặc tên đầy đủ; chỉ trả ngân hàng active và chưa bị xóa.

## Tài khoản đầu tư

CRUD `/api/v1/investment/accounts` chỉ quản lý hồ sơ. Request create/update và response không còn `platformId` hoặc các field balance/capital/profit/reward. Response gồm thông tin nhận diện, liên hệ, `registerDate`, `accountPassword`, `currency`, `status`, `note` và `version`.

`registerDate` nhận ngày lịch ISO `yyyy-MM-dd`, ví dụ `2026-08-18`; timestamp có giờ không thuộc hợp đồng. Các endpoint platform, deposit, task, settlement, reward, withdrawal và ledger cũ đã được gỡ và trả 404.

### Investment Transaction Import

- `POST /api/v1/investment/accounts/{accountId}/transaction-imports`: multipart field `files`, 1–10 ảnh JPEG/PNG/WebP, tối đa 10 MB/ảnh và 50 MB/batch; trả `202`. AI chưa cấu hình trả `503 AI_NOT_CONFIGURED`. Quá 5 batch/phút/user trả `429 IMPORT_RATE_LIMITED` và `Retry-After: 60`.
- `GET /api/v1/investment/accounts/{accountId}/transaction-imports/{batchId}`: polling trạng thái batch, file errors và preview items.
- `POST .../files/{attachmentId}/retry`: retry file AI lỗi khi batch chưa hoàn tất.
- `POST .../{batchId}/confirm`: nhận từng `itemId`, `version`, `selected`, dữ liệu đã sửa và `resolution` (`ACCEPT`, `MERGE_EXISTING`, `SAVE_AS_NEW`, `SKIP`). Backend không tin action/dedup key từ client và xử lý từng item bằng transaction độc lập.
- `GET /api/v1/investment/accounts/{accountId}/transactions`: lọc `fromDate`, `toDate`, `type`, `status`, hỗ trợ page/size/sort.

Batch đi qua `QUEUED`, `PROCESSING`, `READY`/`READY_WITH_ERRORS`, rồi `PARTIALLY_CONFIRMED` hoặc `CONFIRMED`; file lỗi toàn bộ có thể thành `FAILED`. Confirm trả counters và kết quả từng item; confirm lặp không tạo transaction trùng.

Amount được chuẩn hóa dương scale 4, currency phải khớp account, thời gian local mặc định theo `Asia/Ho_Chi_Minh` rồi lưu UTC. External ID tạo unique theo account; item không có external ID dùng fingerprint theo account/type/amount/currency/phút và collision luôn yêu cầu review. Transaction chỉ là lịch sử, không cập nhật account balance.

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

Hai số tiền không được âm và mức thanh toán tối thiểu không được vượt tổng dư nợ. Khi `statementBalance` lớn hơn `0`, `minimumPayment` cũng phải lớn hơn `0`. Khi `statementBalance` bằng `0`, backend tự chuẩn hóa `minimumPayment` về `0`, đánh dấu kỳ `PAID` và không tạo payment 0 đồng, bất kể lựa chọn `UNPAID` hay `PAID` hợp lệ từ client. `paymentStatus` chỉ nhận `UNPAID` hoặc `PAID`. `billingCycleId` xác định đúng kỳ đang hiển thị và có thể là `null` khi job chưa tạo kỳ; khi đó backend chỉ tự tạo kỳ tháng hiện tại nếu đã tới ngày sao kê. Chọn `PAID` cho sao kê có dư nợ ghi một payment `COMPLETED` bằng toàn bộ dư nợ với reference/idempotency key xác định theo statement. Kỳ đã `PAID` không được sửa hoặc chuyển lại `UNPAID`; `version` dùng để phát hiện cập nhật đồng thời.

My cards ưu tiên kỳ chưa thanh toán có `statementDate` mới nhất trên toàn bộ lịch sử, sau đó mới dùng kỳ của tháng hiện tại. Vì vậy kỳ tháng trước vẫn trả `UNPAID` hoặc `OVERDUE` và tiếp tục được cảnh báo cho tới khi thanh toán.

Job tạo kỳ hiện tại chạy theo `CARD_STATEMENT_JOB_CRON` và `CARD_STATEMENT_JOB_TIME_ZONE` (mặc định `00:05`, `Asia/Bangkok`). Job chỉ xử lý thẻ `ACTIVE`, không backfill tháng cũ và dựa trên unique `(user_card_id, statement_date)` để chạy lặp an toàn.

## Dashboard dư nợ thẻ

`GET /api/v1/dashboards/credit-cards` trả snapshot tổng hợp dư nợ của mọi thẻ chưa bị xóa. Response gồm `totalCreditLimit`, `totalStatementDebt`, `currentBalance`, `availableCredit`, `utilizationRate`, `currency` và danh sách `banks`; mỗi ngân hàng chứa đúng một hạn mức chung, `creditLimitVersion`, `balanceVersion`, tổng dư nợ và danh sách chi tiết từng thẻ.

`statementDebt` cộng `statement_balance` của các kỳ còn nợ, còn `currentBalance` áp dụng adjustment mới nhất lên tổng `remaining_amount` thực tế sau payment. Kỳ `PAID` hoặc `CANCELLED` không được tính. Tổng hạn mức và current balance đều có grain theo ngân hàng; dòng thẻ con chỉ giữ chi tiết dư nợ sao kê và hiển thị current balance là dùng chung để tránh cộng lặp. `availableCredit` có thể âm khi vượt hạn mức và `utilizationRate` có thể lớn hơn `100`.

Public catalog chỉ còn `/api/v1/public/banks`. `/api/v1/dashboards/summary`, MCC catalog, card transaction, cashback và discount invoice API đã được gỡ và trả 404.
