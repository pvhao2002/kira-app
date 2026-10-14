# Tóm tắt kỹ thuật – công việc AQS

Nguồn: git diff của 89 ticket AQS có commit của bạn (03/2024 → 09/2026). File này nhóm theo kỹ năng/kỹ thuật, không theo nghiệp vụ. Mã ticket để tra lại trong `md-aqs/<KEY>.md`.

## 1. Tech stack (thấy trực tiếp trong diff)

| Lớp | Công nghệ |
|---|---|
| Backend | Java, Spring Boot, Spring MVC REST, Spring `@Scheduled`, Spring Security (`@PreAuthorize`), `NamedParameterJdbcTemplate`/`MapSqlParameterSource`, Lombok (`@RequiredArgsConstructor`), Guava Cache, Apache POI, Jackson/Gson, RestTemplate, `SseEmitter` |
| Database | MySQL: native SQL, CTE, window function (`ROW_NUMBER() OVER PARTITION BY`), `EXISTS`, `INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, `FORCE INDEX`, `TIMESTAMPDIFF`/`DATE_SUB`, DDL migration script |
| Frontend | Angular (từ bản dùng `*ngFor` đến Angular 21 với signal, `@if`/`@for`, standalone pipe), RxJS (`forkJoin`, `switchMap`, `interval`, `Subject`, `EMPTY`), ngx-bootstrap (modal, popover, tooltip), ng-select (virtual scroll), Angular CDK virtual scroll, ngx-perfect-scrollbar, ngx-infinite-scroll, i18n JSON, SCSS |
| Realtime | WebSocket service (heartbeat), Server-Sent Events (`EventSource` phía client, `SseEmitter` phía server), polling `interval` |
| Tích hợp | Crawler HTTP/JSON (LiveScore, Sofascore), blockchain explorer API (ERC20/TRC20), client gọi dịch vụ AI cấu hình được, callback từ provider (Merito) |
| Khác | Maven `pom.xml`, Dockerfile, SonarQube (sửa issue), unit test (Spring controller test, Angular `.spec.ts`) |

## 2. Năng lực kỹ thuật theo nhóm

### 2.1 Tối ưu SQL và hiệu năng truy vấn
- Viết lại query chậm gây HTTP 524 trên PROD: đổi index hint (`FORCE INDEX (PRIMARY)`, `idx_settlement_actual_date`), join vào bảng tổng hợp sẵn thay vì quét bảng bet lớn, đẩy filter vào subquery. (AQS-4940)
- Dùng `ROW_NUMBER() OVER (PARTITION BY ...)` để lấy top-N theo nhóm (top 50 bet theo league, 200 account đầu mỗi provider). (AQS-4940, AQS-5271)
- Viết lại `LEFT JOIN` + đếm thành chuỗi `EXISTS(...) OR EXISTS(...)` và CTE để kiểm tra "đã có dữ liệu", nhanh hơn và đúng theo từng cấp. (AQS-5295, AQS-5344)
- Dùng CTE + `LEFT JOIN` để giữ cả bản ghi không có dữ liệu con, và running balance theo mốc ngày. (AQS-5706)
- Thêm phân trang `LIMIT/OFFSET` + `COUNT` dùng chung một câu SQL nền. (AQS-5357, AQS-5271)
- Thêm index và cột mới qua script migration. (AQS-5638, AQS-5559)

### 2.2 Hiệu năng frontend
- Sửa trình duyệt bị treo khi render dropdown hàng nghìn phần tử: thay `<select>` bằng `ng-select` có virtual scroll. (AQS-5597)
- Infinite scroll kèm cờ chống gọi trùng (`loadingMap`, `isLoading`) và offset theo từng nhóm. (AQS-5271, AQS-5340)
- Thử CDK virtual scroll cho bảng lớn (sau đó bị revert theo yêu cầu). (AQS-5357)
- Giảm tải refresh định kỳ (15 s → 60 s) và `unsubscribe` trong `ngOnDestroy` để tránh rò rỉ. (AQS-5078)
- Gọi API tuần tự hoặc song song có kiểm soát bằng `forkJoin` + `switchMap` thay cho callback lồng nhau. (AQS-5368)

### 2.3 Xử lý bộ nhớ và tài nguyên phía backend
- Sửa lỗi export Excel/PDF làm user bị đăng xuất: Apache POI tạo `CellStyle` mới cho mỗi ô, vượt giới hạn style. Đã cache style theo `StyleKey`, gom theo từng workbook bằng Guava `Cache` (`expireAfterAccess`). (AQS-5282)
- Bỏ `@Transactional` không cần thiết trên các hàm chỉ đọc. (AQS-5368)

### 2.4 Scheduled job và xử lý nền
- Viết job `@Scheduled` chạy theo chu kỳ 10 s / 30 s / 60 s, có `initialDelay`, xử lý theo batch (claim tối đa 100 bản ghi pending từ bảng queue). (AQS-5640, AQS-5573, AQS-5230)
- Thiết kế job chịu lỗi: timeout connect/read 15 s, bắt và log lỗi theo từng phần tử để một lỗi không làm hỏng cả vòng. (AQS-5308)
- Gỡ job lỗi thời an toàn: xóa scheduler, service và hằng SQL liên quan. (AQS-5502)
- Sửa lỗi timestamp lệch giây khi insert hàng loạt bằng cách dùng giá trị cố định cho cả batch thay vì `current_time`. (AQS-5475)

### 2.5 Thiết kế hướng cấu hình (config-driven)
- Đưa SQL, ngưỡng và rule ra bảng `system_config` hoặc bảng cấu hình riêng để đổi hành vi mà không cần deploy: SQL report, stake threshold, danh sách role, band thời gian, market type, cấu hình AI. (AQS-5078, AQS-5573, AQS-5578, AQS-5739, AQS-5745, AQS-5640)
- Parser số dư theo rule JSON (`parse_rule`: type, decimals, path, field, match), thêm network/token mới chỉ cần thêm dữ liệu. (AQS-5308)
- Resolver hiển thị selection có strategy và rule theo sport/page/market, dùng template `{{token}}`, có API GET/PUT để cấu hình. (AQS-5584)
- Có cache config với TTL (2 phút, 10 phút) và hàm đọc bỏ qua cache khi cần dữ liệu mới. (AQS-5078, AQS-5573, AQS-5612)
- Cấu hình có validate và trả lỗi rõ khi sai; UI khóa thao tác khi config lỗi. (AQS-5715)

### 2.6 Realtime và trạng thái online
- Heartbeat service: lưu thời điểm heartbeat theo user trong `ConcurrentMap`, job 30 s đánh dấu offline. Tránh race condition bằng `cacheMap.remove(key, lastHeartbeat)`. (AQS-5426, AQS-5643)
- Đẩy số user online bằng SSE: server dùng `SseEmitter` broadcast, client dùng `EventSource` có parser, tự reconnect, gắn token, expose qua Angular signal. (AQS-5643)
- Polling có điều kiện (chỉ poll khi user online); chuông cảnh báo poll 10 s, cập nhật ngay qua `Subject` khi có sự kiện. (AQS-5643, AQS-5640, AQS-5757)

### 2.7 Crawler và tích hợp hệ thống ngoài
- Crawler live score cho hai nguồn (LiveScore, Sofascore): map JSON sang model, upsert theo set/inning, ghi log body khi nội dung đổi, endpoint chạy tay để test. Header bắt buộc của Sofascore sinh từ SHA-256 của timestamp. (AQS-5230, AQS-5232)
- Xử lý callback từ provider, gán account tự động theo ngưỡng có quy đổi tiền tệ. (AQS-5573)
- Client gọi dịch vụ AI (bật/tắt, URL, API key, prompt đều cấu hình trong DB) để kiểm tra bổ sung. (AQS-5640)

### 2.8 Thuật toán và so khớp dữ liệu
- Phát hiện event bị map đảo đội: tách tên bằng regex, chuẩn hóa (`reduceNoise`), so khớp tên bằng Jaro-Winkler (cutoff 0.92), lưu trạng thái `CHECKED_OK` / `CONFIRMED_OPPOSITE` / `FAILED`. (AQS-5640)
- Gom nhóm và dedupe dữ liệu bằng Java Stream (`groupingBy`, `toMap` có merge function, `distinct`, comparator nhiều tầng với `nullsLast`). (AQS-5277, AQS-5690, AQS-5686)
- Duyệt cây phân cấp account (parent_id), mở rộng theo path và tạo node tạm khi thiếu. (AQS-5612)

### 2.9 Tính toán số và tiền tệ
- Quy đổi odds giữa các format (DEC/HK/MY), xử lý odds âm, Lay/Back. (AQS-4759, AQS-5478, AQS-5536, AQS-5605)
- Cắt bớt chữ số thập phân thay vì làm tròn (`Math.trunc`) qua pipe standalone dùng lại được. (AQS-5567, AQS-5584)
- Chống chia cho 0 (Infinity), xử lý giá trị falsy `0` trong template (`!== null` thay cho truthy). (AQS-5432, AQS-4203, AQS-5515)
- Quy đổi tiền tệ theo bảng tỷ giá trong SQL. (AQS-5482, AQS-5573)

### 2.10 API design và bảo mật
- Thiết kế REST endpoint mới có phân quyền `@PreAuthorize(hasAuthority(...))` theo từng tính năng. (AQS-5612, AQS-5638, AQS-5640, AQS-5559, AQS-5739)
- Map `IllegalArgumentException` → HTTP 400, bắt `DuplicateKeyException` để trả thông báo nghiệp vụ. (AQS-5739, AQS-5308)
- Validate input ở server (band hợp lệ, market thuộc allowlist, tổ hợp filter không mâu thuẫn). (AQS-5715, AQS-5739)
- Audit log thay đổi trong cùng transaction (`@Transactional`, chỉ ghi khi giá trị thực sự đổi). (AQS-5638, AQS-5559)
- Nâng thư viện có lỗ hổng bảo mật (guava 31.1 → 33.1.0) trên 4 service. (AQS-4050)

### 2.11 Frontend architecture
- Tái sử dụng một component cho nhiều biến thể report qua route param `:source` thay vì nhân bản code (sau khi bỏ hướng tạo component riêng). (AQS-4480, AQS-5368, AQS-5559)
- Tách helper/pipe/service dùng chung: `TruncateDecimalPipe`, `FormatValuePipe` có `zeroPlaceholder`, layout-source helper, config service có cache. (AQS-5567, AQS-5685, AQS-5559, AQS-5715)
- Multi-select dạng popover có Select All và nhãn "+N". (AQS-5745)
- Sửa lỗi Angular forms: thiếu `name` trên control `ngModel`, sửa snapshot `form.value` thay vì `FormControl.setValue`. (AQS-5382, AQS-5511)
- Popover render ra `body` (`container: 'body'`) để không bị cắt bởi vùng cuộn; đồng bộ chiều cao dòng giữa 2 bảng tách cột. (AQS-5284, AQS-4383)
- Input số có chuẩn hóa và validate bước giá trị (.00/.25/.50/.75), kèm spec test. (AQS-5643)

### 2.12 Bảo trì và chất lượng code
- Chuyển field injection `@Autowired` sang constructor injection trên 63 file, sửa cảnh báo Sonar. (AQS-5271)
- Dọn code chết, hàm và hằng không dùng; gom logic trùng thành hàm chung (`appendCommonBetFilters`, `resolveCurrentSourceFilter`). (AQS-5740, AQS-5559)
- Quản lý revert và reapply có kiểm soát khi hướng làm không đạt (AQS-5368, AQS-5357, AQS-5692), cherry-pick lên nhiều nhánh develop/staging/prod. (AQS-5597)

## 3. Bullet CV kỹ thuật (tiếng Anh, chọn 5–8)

- Diagnosed and fixed production query timeouts (HTTP 524) by rewriting MySQL queries with index hints, window functions and pre-aggregated tables.
- Fixed an Excel export crash that logged users out by caching Apache POI cell styles per workbook (Guava cache).
- Built real-time presence tracking using a WebSocket heartbeat service and Server-Sent Events, with a race-safe offline sweep (`ConcurrentMap.remove(key, value)`).
- Designed config-driven features (SQL, thresholds, rules, JSON parse rules stored in DB with TTL cache), so behavior changes need no redeploy.
- Wrote scheduled crawlers and batch jobs (10–60 s cycles, queue claiming, per-item fault isolation, 15 s timeouts) for live scores, wallet balances and data validation.
- Implemented fuzzy team-name matching (Jaro-Winkler, regex normalization) with an optional AI verification step to detect reversed event mappings.
- Fixed browser freezes on large Angular pages using virtual scroll (ng-select, CDK) and infinite scroll with request de-duplication.
- Built secured REST APIs (Spring Security authorities, server-side validation, transactional audit logs) and reusable Angular components, pipes and services across 4 Angular apps.
