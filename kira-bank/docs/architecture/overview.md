# Kiến trúc

Kira Bank là modular monolith: Angular gọi REST `/api/v1`, Spring Boot áp dụng authentication/ownership/business rules và MySQL giữ dữ liệu qua Flyway. `creditcard` quản lý thẻ, sao kê và payment; `investment` quản lý hồ sơ cùng transaction history nhập qua AI. Hai context dùng chung identity, attachment, notification và audit nhưng không tạo coupling ghi chéo.

```mermaid
flowchart LR
 UI[Angular 22] --> API[Spring Boot modular monolith]
 API --> ID[Identity]
 API --> F1[Flow 1 - Credit Card]
 API --> F2[Investment profiles and transaction import]
 F2 --> AI[Cloudflare Workers AI]
 F2 --> R2[Cloudflare R2]
 ID --> DB[(MySQL 8)]
 F1 --> DB
 F2 --> DB
```

Upload lưu attachment và tạo batch nhanh; scheduler claim queue theo lock DB, gửi tối đa 3 ảnh/request và ghi preview staging. Angular polling batch, người dùng chỉnh sửa/resolution, rồi confirm từng item. Scheduler retention hằng ngày purge object R2 đã hết hạn nhưng giữ metadata và source links.
