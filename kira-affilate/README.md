# Kira Affiliate (`kira-affilate`)

Nền tảng quản lý Shopee Affiliate cho người dùng Việt Nam: chuyển đổi liên kết, theo dõi đơn hàng và hoa hồng,
thống kê, tra cứu sản phẩm/chiến dịch, hướng dẫn, thuế và pháp luật.

| Thư mục | Nội dung |
|---|---|
| `kira-affilate-service/` | API — Java 25, Spring Boot 3.5, MySQL 8, Flyway |
| `kira-affilate-ui/` | Giao diện — Angular 22, Tailwind v4, Chart.js (tiếng Việt) |
| `docs/api.md` | Hợp đồng API giữa UI và service |
| `docs/shopee-api.md` | Những gì đã/chưa xác minh về Shopee Affiliate Open API |
| `docs/deployment.md` | Triển khai và checklist production |

## Chạy local
Yêu cầu: JDK 25, Maven, Node 24, Docker.

```bash
cd kira-affilate
cp .env.example .env          # điền DB_PASSWORD, JWT_SECRET, SHOPEE_CREDENTIAL_ENCRYPTION_KEY
docker compose up -d          # MySQL tại 127.0.0.1:3309

cd kira-affilate-service      # API tại http://localhost:8082
while IFS='=' read -r k v; do [ -n "$v" ] && export "$k=$v"; done < <(grep -v '^#' ../.env | grep '=')
JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn spring-boot:run

cd ../kira-affilate-ui        # UI tại http://localhost:4202 (proxy /api → 8082)
npm ci && npm start
```

Đăng ký tài khoản trên UI, rồi vào **Cài đặt → Shopee API** nhập AppID và Secret lấy tại
<https://affiliate.shopee.vn/open_api>. Mỗi người dùng tự nhập thông tin của mình; Secret được mã hóa AES-256-GCM
trong cơ sở dữ liệu và không bao giờ được trả về.

## Kiểm thử
```bash
cd kira-affilate-service && JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn -q verify   # unit + integration (cần Docker)
cd kira-affilate-ui && npx ng test --watch=false && npx ng build
cd kira-affilate-ui && npx playwright test                                             # cần API + UI đang chạy
```
Kiểm thử với Shopee API thật: đặt `SHOPEE_APP_ID`, `SHOPEE_SECRET` rồi chạy `mvn -q verify -Dit.test=ShopeeLiveIT`.

## Giới hạn cần biết
- **Không có số lượt nhấp và tỷ lệ chuyển đổi theo lượt nhấp**: Shopee Open API không cung cấp. Ứng dụng ghi rõ
  điều này thay vì ước lượng.
- **Không có trạng thái "đã thanh toán"** từ API. Nhóm "Đã đối soát thanh toán" dựa trên báo cáo đối soát
  (`validationId`) do người dùng nhập.
- Hiệu quả theo từng liên kết chỉ xác định được qua **Sub ID** / chiến dịch.
- Tài liệu Open API của Shopee nằm sau đăng nhập; tên truy vấn và trường dữ liệu cần được xác nhận bằng
  `ShopeeLiveIT` với tài khoản thật (xem `docs/shopee-api.md`).
- Quyền dùng Open API do Shopee cấp cho từng tài khoản (lỗi 10035 = chưa được cấp).
- Nội dung thuế/pháp luật là thông tin tham khảo, không phải tư vấn; mục chưa đối chiếu văn bản gốc được gắn nhãn.
- Đồng bộ chạy trên một instance (xem `docs/deployment.md`).
