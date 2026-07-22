# Triển khai production

Đặt secret trong secret manager, bật TLS, đổi refresh cookie sang `Secure`, tắt development seed, dùng object storage/virus scanning cho attachment và vận hành MySQL backup/PITR. Chạy Flyway từ một backend instance trước khi scale ngang.
