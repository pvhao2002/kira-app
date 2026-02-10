# Reference – Design tokens & Backend performance

## Design tokens (đồng bộ web & mobile)

Dùng các token sau cho cả **kira-ui** (web) và **mobile-app** để màu sắc đồng nhất.

| Token        | Light (web & mobile) | Dark (web & mobile) | Ghi chú        |
|-------------|----------------------|---------------------|----------------|
| primary/tint | `#0a7ea4`            | `#fff`              | CTA, link, tab |
| text         | `#11181C`            | `#ECEDEE`           | Chữ chính      |
| background   | `#fff`               | `#151718`           | Nền            |
| border       | `#E5E5E7`            | `#2C2C2E`           | Viền           |
| card         | `#F8F9FA`            | `#1C1C1E`           | Nền card       |
| icon/default | `#687076`            | `#9BA1A6`           | Icon không chọn |

- Web: khai báo trong `:root` (và `.dark` nếu dùng class) hoặc `tailwind.config.js` theme.
- Mobile: đã có trong `constants/theme.ts` (Colors.light / Colors.dark). Khi thêm token mới, cập nhật cả hai nơi và bảng này.

## Semantic colors (gợi ý)

- Success: xanh lá (ví dụ `#22c55e`).
- Error: đỏ (ví dụ `#ef4444`).
- Warning: vàng/cam (ví dụ `#f59e0b`).

Dùng cùng hex (hoặc biến tham chiếu) trên web và mobile.

---

## Backend performance – Chi tiết

### Database (kira-service, kira-queue)

- Index: mỗi WHERE / JOIN / ORDER BY thường dùng nên có index phù hợp; tránh index thừa.
- N+1: dùng JOIN hoặc batch query (ví dụ `IN` có giới hạn) thay vì query trong vòng lặp.
- Batch: insert/update nhiều bản ghi dùng batch (JDBC batch, JPA batch size) với kích thước hợp lý (vd 500–1000).
- Chỉ SELECT cột cần; tránh `SELECT *` trên bảng nhiều cột.

### API (REST)

- Pagination: list luôn có limit/offset hoặc cursor; không trả toàn bộ tập lớn.
- DTO: chỉ trả field client cần; tách DTO đọc/ghi nếu cần.
- Cache: GET ít thay đổi có thể cache (in-memory hoặc Redis) với TTL; invalidate khi dữ liệu thay đổi.

### Queue / async (kira-queue)

- Message size hợp lý; payload lớn nên lưu reference (vd URL, id) thay vì embed.
- Consumer: xử lý theo batch nếu có thể; commit/ack đúng để tránh duplicate hoặc mất message.
- Timeout và retry: cấu hình rõ; tránh block worker quá lâu.

### Đo lường

- Log thời gian xử lý cho API/job quan trọng (vd `@Around` hoặc middleware).
- Khi nghi ngờ bottleneck: profile (JVM, DB slow query log) rồi mới tối ưu.
