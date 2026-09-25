# Thẻ tín dụng: nhập sao kê bằng AI và gợi ý thẻ

Tất cả endpoint dưới `/api/v1`, yêu cầu đăng nhập và chỉ thao tác trên thẻ của chính user. Tiền là `DECIMAL(19,4)`
(`BigDecimal` ở backend); lỗi theo dạng chung `{timestamp, status, code, message, fieldErrors, path, traceId}`.

## Nhập sao kê bằng AI

| Method | Path | Mô tả |
|---|---|---|
| POST | `/credit-cards/{cardId}/statement-imports` | multipart `files` (1–3 ảnh JPEG/PNG/WebP ≤ 10 MB, cùng một kỳ, theo thứ tự trang) → `202` import `QUEUED` |
| GET | `/credit-cards/{cardId}/statement-imports` | 20 lượt nhập gần nhất của thẻ |
| GET | `/statement-imports/{id}` | trạng thái + bản nháp đã chuẩn hóa (`draft`) để review |
| POST | `/statement-imports/{id}/retry` | body `{version}`; chỉ cho `FAILED` còn ảnh |
| POST | `/statement-imports/{id}/cancel` | body `{version}`; không hủy được khi `PROCESSING`/`CONFIRMED` |
| POST | `/statement-imports/{id}/confirm` | body là bản người dùng đã sửa (xem dưới) |

Trạng thái: `QUEUED → PROCESSING → READY → CONFIRMED`, hoặc `FAILED`/`CANCELLED`. Sau khi upload commit, AI chạy ngay trên
executor riêng (tối đa 2 lượt đồng thời). Nếu AI chưa cấu hình hoặc đang bận, import giữ `QUEUED` và
`CardStatementImportScheduler` xử lý theo `CARD_STATEMENT_IMPORT_CRON` (mặc định mỗi giờ phút 10). Retry dùng
`ai.job.max-attempts` và `ai.job.retry-delay`; lượt kẹt quá `ai.job.processing-timeout` được đưa lại hàng đợi. Khi xong
có thông báo `CREDIT_STATEMENT_IMPORT_READY` hoặc `CREDIT_STATEMENT_IMPORT_FAILED`.

`draft` gồm số tổng (`statementDate`, `dueDate`, `periodStart/End`, `openingBalance`, `totalSpending`, `totalRefund`,
`totalFee`, `totalInterest`, `statementBalance`, `minimumPayment`), `warnings` (mã) và `transactions[]` với
`transactionType` ∈ `SPENDING|REFUND|FEE|INTEREST|CASHBACK`, `mccCode`, `cashbackRuleId` gợi ý, `duplicate`, `needsReview`.
Mã cảnh báo: `CURRENCY_MISMATCH`, `CARD_LAST_FOUR_MISMATCH`, `LOW_CONFIDENCE` (< 0.80), `FIELD_MISSING`, `TOTAL_MISMATCH`,
`PAYMENT_ROWS_IGNORED`, `UNCERTAIN_FIELDS`, `DUPLICATE`. Dòng thanh toán thẻ (`PAYMENT`) bị bỏ qua vì thanh toán quản lý ở
`/statements/{id}/payments`.

Body confirm:

```json
{
  "version": 3, "statementDate": "2026-09-15", "dueDate": "2026-10-05", "periodStart": "2026-08-16", "periodEnd": "2026-09-15",
  "openingBalance": 0, "totalSpending": 5200000, "totalRefund": 0, "totalFee": 0, "totalInterest": 0,
  "statementBalance": 5200000, "minimumPayment": 260000,
  "transactions": [{"include": true, "transactionDate": "2026-08-20", "postingDate": null, "description": "GRAB",
    "amount": 120000, "transactionType": "SPENDING", "mccCode": "4121", "cashbackRuleId": 12}]
}
```

Response: `{statementId, totalsApplied, inserted, skipped, supersededManual, expectedCashback}`. Confirm lần hai trả lại
kết quả đã lưu (idempotent). Mã lỗi: `STATEMENT_IMPORT_NOT_FOUND`, `STATEMENT_IMPORT_NOT_READY`,
`STATEMENT_IMPORT_VERSION_CONFLICT`, `STATEMENT_IMPORT_FILES_REQUIRED`, `STATEMENT_IMPORT_TOO_MANY_FILES`,
`INVALID_FILE_TYPE`, `STATEMENT_IMPORT_PROCESSING`, `STATEMENT_IMPORT_ALREADY_CONFIRMED`, `STATEMENT_IMPORT_NOT_RETRYABLE`,
`ATTACHMENT_PURGED`, `CASHBACK_RULE_NOT_FOUND`, `INVALID_STATEMENT_DATES`, `MINIMUM_PAYMENT_REQUIRED`,
`MINIMUM_PAYMENT_EXCEEDS_BALANCE`, `STATEMENT_VERSION_CONFLICT`.

## Giao dịch thẻ và tiến độ cashback

| Method | Path | Mô tả |
|---|---|---|
| GET | `/card-transactions?cardId&fromDate&toDate&type&q&page&size` | mọi thẻ của user; `q` tìm trong mô tả; mỗi dòng có `cardNickname`, `cardLastFour` |
| GET | `/credit-cards/{cardId}/transactions?fromDate&toDate&page&size` | danh sách `{data, meta}` của một thẻ |
| POST | `/credit-cards/{cardId}/transactions` | ghi tay; header `Idempotency-Key` bắt buộc; body `{transactionDate, description, amount, transactionType?, mccCode?, cashbackRuleId?}` |
| PUT | `/card-transactions/{id}` | sửa đầy đủ `{transactionDate, description, amount, transactionType, mccCode, cashbackRuleId, version}`; không đổi dedup key và không đổi số tổng statement |
| DELETE | `/card-transactions/{id}?version=` | xóa mềm |
| GET | `/credit-cards/{cardId}/cashback-progress` | đã chi/đã hoàn/còn lại từng nhóm và trần tháng trong kỳ hiện tại |

MCC để trống khi thêm/sửa sẽ được tự điền theo quy tắc cửa hàng. Mã lỗi: `CARD_TRANSACTION_NOT_FOUND`,
`CARD_TRANSACTION_VERSION_CONFLICT`, `CARD_TRANSACTION_DUPLICATE`, `IDEMPOTENCY_KEY_REQUIRED`, `INVALID_DATE_RANGE`.

## Quy tắc cửa hàng (merchant rules)

Sao kê ngân hàng Việt Nam hầu như không in MCC, nên người dùng lưu quy tắc "mô tả chứa từ khoá → MCC" theo user (không
theo thẻ; nhóm cashback của từng thẻ được suy ra từ MCC).

| Method | Path | Mô tả |
|---|---|---|
| GET | `/card-merchant-rules` | danh sách quy tắc |
| POST | `/card-merchant-rules` | `{pattern, mccCode, label?, applyToExisting?}` → `{rule, updatedTransactions}` |
| PUT | `/card-merchant-rules/{id}` | `{pattern, mccCode, label?, version}` |
| DELETE | `/card-merchant-rules/{id}?version=` | xoá mềm; giao dịch cũ giữ MCC |

- Từ khoá được chuẩn hoá (chữ thường, gộp khoảng trắng), dài 2–100 ký tự, duy nhất theo user
  (`MERCHANT_RULE_DUPLICATE`, `MERCHANT_RULE_PATTERN_INVALID`, `MERCHANT_RULE_VERSION_CONFLICT`, `MERCHANT_RULE_NOT_FOUND`).
- Khớp bằng "mô tả chứa từ khoá", từ khoá dài nhất thắng. Áp dụng khi AI tạo bản nháp (dòng không có MCC in trên sao kê;
  `merchantRuleApplied=true` và quy tắc được ưu tiên hơn nhóm AI đoán), khi thêm/sửa giao dịch với MCC trống.
- `applyToExisting` chỉ điền MCC cho giao dịch chưa có MCC và chưa gán nhóm.
- Confirm sao kê: mỗi dòng có thể gửi `rememberPattern`; nếu dòng được lưu và có MCC, quy tắc được tạo hoặc cập nhật.

## Deep link thông báo

`deepLink` lưu theo slug mobile. Web ánh xạ `/statement-import?id=X` → `/app/credit-card/statement-import?importId=X`,
`/billing-cycle`, `/statement-pay` → `/app/credit-cards`, `/ai-result`, `/queue` → `/app/investment/ai-queue`; action "Mở"
đánh dấu đã đọc rồi điều hướng. Mobile mở màn hình trạng thái chỉ-xem (thử lại/huỷ; xác nhận thực hiện trên web).

## Gợi ý thẻ

`GET /credit-card-recommendations?mcc=5812&amount=500000` (`amount` tùy chọn) trả mọi thẻ `ACTIVE` đã xếp hạng:
`estimatedCashback`, `cashbackRate`, nhóm khớp, `ruleCap/ruleRemaining`, `cardCap/cardRemaining`, `availableCredit`,
`insufficientCredit`, kỳ hiện tại và `reasons` (`NO_CASHBACK_PROGRAM`, `NO_MATCHING_RULE`, `RULE_CAP_REACHED`,
`CARD_CAP_REACHED`, `PARTIALLY_CAPPED`, `INSUFFICIENT_CREDIT`, `CREDIT_LIMIT_UNKNOWN`). Thứ tự: đủ hạn mức trước, rồi
cashback ước tính, tỷ lệ, hạn mức khả dụng giảm dần. `INVALID_MCC` khi `mcc` không phải 4 chữ số.

## Quy tắc tính

- Kỳ tính trần = kỳ sao kê của thẻ: từ ngày sau `statementDay` kỳ trước đến `statementDay` kỳ này (giờ
  `CARD_STATEMENT_JOB_TIME_ZONE`).
- Mỗi nhóm: `min(max(0, Σ SPENDING − Σ REFUND) × rate / 100, maxCashbackAmount)`; tổng thẻ chặn bởi `monthlyCashbackCap`.
  Chỉ tính chương trình đang bật. Giao dịch gắn `cashbackRuleId` dùng nhóm đó; nếu không, MCC khớp nhóm có tỷ lệ cao nhất.
- Hạn mức khả dụng (ước tính) = hạn mức chung ngân hàng − dư nợ ngân hàng hiện tại − chi tiêu ghi tay chưa lên sao kê
  trong kỳ của các thẻ cùng ngân hàng.
