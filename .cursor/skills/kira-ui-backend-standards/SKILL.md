---
name: kira-ui-backend-standards
description: Guides modern, user-friendly UI with consistent colors across web (kira-ui) and mobile (mobile-app), and backend performance optimization. Use when designing or implementing UI, defining themes or styles, implementing/reviewing backend (kira-service, kira-queue) code, or when the user mentions giao diện, màu sắc, hiệu năng, performance.
---

# Kira UI & Backend Standards

## Khi nào áp dụng

- Thiết kế hoặc implement giao diện (web Angular, mobile React Native).
- Định nghĩa theme, màu sắc, typography cho web hoặc mobile.
- Implement hoặc review code backend (Java/Spring) liên quan hiệu năng.

---

## 1. Giao diện (UI)

### Nguyên tắc chung

- **Hiện đại**: Layout gọn, khoảng trắng hợp lý, typography rõ ràng, component có trạng thái rõ (hover, focus, disabled).
- **Thân thiện**: Copy dễ hiểu, feedback ngay (loading, success, error), tránh jargon không cần thiết.
- **Đồng nhất web & mobile**: Cùng bảng màu chính, cùng ý nghĩa màu (primary, success, error…). Web và mobile có thể dùng token khác nhau nhưng giá trị màu nên sync (xem [reference.md](reference.md)).

### Màu sắc đồng nhất

- Định nghĩa **design tokens** (primary, background, text, border, card…) cho cả hai nền tảng.
- Web: dùng CSS variables (`:root`) hoặc Tailwind theme; sync với palette trong `mobile-app/constants/theme.ts`.
- Mobile: giữ `Colors.light` / `Colors.dark` và đảm bảo hex/tên màu trùng ý nghĩa với web (ví dụ cùng tint/primary, cùng semantic success/error).
- Khi thêm màu mới: cập nhật cả kira-ui và mobile-app; ghi chú trong reference nếu cần.

### Checklist UI nhanh

- [ ] Màu dùng từ theme/tokens, không hardcode hex trừ khi là token.
- [ ] Có hỗ trợ dark/light nếu app hỗ trợ.
- [ ] Loading và lỗi có trạng thái hiển thị rõ.
- [ ] Touch target đủ lớn trên mobile (min ~44pt).
- [ ] Text đủ tương phản (contrast) so với nền.

---

## 2. Backend – Tối ưu hiệu năng

### Nguyên tắc

- Mọi API và xử lý batch đều cần xem xét **latency**, **throughput** và **tài nguyên** (CPU, RAM, DB, I/O).
- Ưu tiên đo và tối ưu theo số liệu (logging, metrics), tránh tối ưu sớm không cần thiết.

### Checklist nhanh

- [ ] **DB**: Query có index phù hợp; tránh N+1; dùng batch insert/update khi có nhiều bản ghi; chỉ SELECT cột cần.
- [ ] **API**: Response gọn (không trả thừa field); dùng pagination cho list; cache (local/distributed) khi đọc nhiều, ít thay đổi.
- [ ] **I/O & bất đồng bộ**: Không block thread cho I/O chậm; dùng async/non-blocking hoặc queue (ví dụ kira-queue) cho tác vụ nặng.
- [ ] **Tài nguyên**: Đóng connection/stream đúng cách; tránh leak; giới hạn kích thước batch và timeout.

### Khi thêm/chỉnh API hoặc job

1. Ước lượng volume và độ trễ chấp nhận được.
2. Viết query/aggregation tối giản; kiểm tra execution plan nếu cần.
3. Thêm cache hoặc index nếu profile cho thấy bottleneck.
4. Ghi chú trong code hoặc doc nếu có trade-off (ví dụ consistency vs performance).

---

## Tài liệu thêm

- Bảng màu và token đồng bộ web/mobile: [reference.md](reference.md).
