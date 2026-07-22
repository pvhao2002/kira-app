# API

OpenAPI tương tác: `http://localhost:8080/swagger-ui.html`.

Các request tài chính quan trọng cần header `Idempotency-Key` là UUID do client tạo. Danh sách trả `{ data, meta }`; lỗi trả `{ timestamp, status, code, message, fieldErrors, path, traceId }`.

Nhóm chính: `/api/v1/auth`, `/api/v1/public`, `/api/v1/credit-cards`, `/api/v1/card-transactions`, `/api/v1/statements`, `/api/v1/discount-invoices`, `/api/v1/investment/accounts`, `/api/v1/investment/deposits`, `/api/v1/investment/tasks`, `/api/v1/investment/withdrawals` và ledger theo account.

