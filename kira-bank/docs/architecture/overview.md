# Kiến trúc

Kira Bank là modular monolith: Angular gọi REST `/api/v1`, Spring Boot áp dụng authentication/ownership/business rules và MySQL giữ dữ liệu qua Flyway. `creditcard` và `investment` là hai bounded context độc lập, chỉ dùng chung identity, attachment, notification và audit.

```mermaid
flowchart LR
 UI[Angular 22] --> API[Spring Boot modular monolith]
 API --> ID[Identity]
 API --> F1[Flow 1 - Credit Card]
 API --> F2[Flow 2 - Investment]
 ID --> DB[(MySQL 8)]
 F1 --> DB
 F2 --> DB
```

