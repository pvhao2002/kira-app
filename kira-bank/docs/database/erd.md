# ERD rút gọn

```mermaid
erDiagram
 users ||--o{ user_credit_cards : owns
 users ||--o{ user_bank_credit_limits : owns
 users ||--o{ user_bank_balance_adjustments : creates
 banks ||--o{ user_credit_cards : issues
 banks ||--o{ user_bank_credit_limits : limits
 banks ||--o{ user_bank_balance_adjustments : adjusts
 user_credit_cards ||--o{ statements : receives
 user_credit_cards ||--o| user_card_cashback_configs : caps
 user_credit_cards ||--o{ credit_card_cashback_programs : configures
 credit_card_cashback_programs ||--|{ credit_card_cashback_rules : contains
 credit_card_cashback_rules ||--|{ credit_card_cashback_rule_mccs : includes
 statements ||--o{ payments : paid_by
 users ||--o{ investment_accounts : owns
 users ||--o{ attachments : uploads
 users ||--o{ cloudflare_accounts : configures
 users ||--o{ password_vault_modules : owns
 users ||--o{ password_vault_accounts : owns
 users ||--o{ password_vault_unlock_sessions : unlocks
 password_vault_modules ||--o{ password_vault_accounts : contains
 cloudflare_accounts ||--o{ attachments : stores
 investment_accounts ||--o{ investment_transaction_import_batches : imports
 investment_transaction_import_batches ||--o{ investment_transaction_import_files : contains
 investment_transaction_import_batches ||--o{ investment_transaction_import_items : stages
 investment_accounts ||--o{ investment_account_transactions : records
 attachments ||--o{ investment_transaction_import_files : supplies
 investment_account_transactions }o--o{ attachments : sourced_from
```

`user_bank_credit_limits` có unique `(user_id, bank_id)`; các thẻ của cùng user và bank dùng chung bản ghi hạn mức này.

`user_bank_credit_limits.balance_version` là phiên bản riêng cho dư nợ dùng chung và không làm thay đổi optimistic-lock `version` của hạn mức. `user_bank_balance_adjustments` là lịch sử append-only, unique `(user_id, bank_id, balance_version)`; mỗi dòng lưu balance gốc, balance trước/sau, amount thay đổi, offset, lý do và người thực hiện. Không có thao tác update hoặc delete adjustment trong application repository.

`user_credit_cards.card_type` lưu tên loại thẻ tự nhập với tối đa 150 ký tự. Cột cho phép `NULL` để giữ tương thích với dữ liệu đã tồn tại trước migration V9; API bắt buộc giá trị này cho mọi thao tác tạo hoặc cập nhật thẻ mới.

V20 thêm cấu hình cashback riêng theo `user_credit_cards`: `user_card_cashback_configs` giữ một trần tháng và version độc lập cho mỗi thẻ; `credit_card_cashback_programs` giữ chương trình bật/tắt; `credit_card_cashback_rules` giữ nhóm danh mục, tỷ lệ và trần nhóm; `credit_card_cashback_rule_mccs` giữ các MCC bốn chữ số. Tất cả đều có audit/version/xóa mềm và không liên kết với transaction hoặc statement.

`investment_accounts` là bảng hồ sơ độc lập theo user. Bảng không còn `platform_id` hoặc các cột balance/capital/profit/reward.

V14 tạo `investment_account_transactions` làm lịch sử chính thức cùng các bảng batch/file/item staging và source links. Unique `(investment_account_id, deduplication_key)` và `(investment_account_id, external_transaction_id)` là lớp bảo vệ concurrent confirm cuối cùng. `attachments.ai_schema_version` giới hạn tái sử dụng AI result theo schema; `storage_purged_at` giữ audit/hash sau khi object R2 bị xóa.

V17 thêm capability tìm trọ: `lodging_listings` thuộc owner nhưng được đọc chung; `lodging_reference_locations` là danh mục điểm đến dùng chung; `lodging_listing_locations` giữ snapshot km/trạng thái Mapbox; `lodging_listing_images` liên kết attachment ảnh; `lodging_reviews` unique theo `(listing_id, user_id)` để mỗi user có đúng một review.

V18 thêm `ai_provider_accounts` cho danh sách Cloudflare Workers AI theo priority. API token chỉ lưu dưới dạng AES-256-GCM ciphertext; trạng thái kiểm tra, cooldown và lỗi an toàn gần nhất phục vụ failover mà không ghi token vào audit hoặc response.

V19 đổi bảng thành `cloudflare_accounts`, thêm model AI và credential/trạng thái R2 độc lập. `attachments.r2_account_id` cố định nơi lưu object; generated unique key bảo đảm chỉ một R2 account active làm primary. Attachment cũ để `NULL` cho tới khi Admin xác nhận gán vào bucket đã test.

V21 thêm password vault cá nhân. `password_vault_modules` và `password_vault_accounts` đều có owner, optimistic version và soft delete. Account chỉ giữ ciphertext, nonce, wrapped DEK, key ID và crypto version; secret plaintext không có cột riêng. `password_vault_unlock_sessions` chỉ giữ hash token ngắn hạn và trạng thái thu hồi. Các sự kiện create/update/delete/unlock/reveal/copy được ghi vào `audit_logs` mà không chứa secret hoặc ciphertext.

V13 xóa các bảng legacy: `service_providers`, `merchants`, `mccs`, `card_transactions`, `cashback_records`, `discount_invoices`, `investment_platforms`, `investment_deposits`, `investment_tasks`, `investment_task_settlements`, `investment_rewards`, `investment_withdrawals` và `investment_ledger_entries`.
