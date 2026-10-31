# Kira News 247

Website đọc tin tức tiếng Việt. AI (ChatGPT Codex, computer use) viết bản nháp mỗi ngày qua trang quản trị; chủ báo
chỉ việc duyệt, hoặc góp ý để AI sửa. Mỗi lượt đọc được làm giàu bằng ipinfo.io ở trình duyệt người đọc.

| Phần | Công nghệ |
|---|---|
| `proto/` | Protobuf contract duy nhất (`application/x-protobuf`, không có JSON API) |
| `kira-news-247-service/` | Java 25, Spring Boot 3.5, Spring Security (session + CSRF cookie), JPA, Flyway, Oracle |
| `kira-news-247-ui/` | Angular 21 SSR (zoneless, Signals, `httpResource`, RxJS), Tailwind v4, spartan-ng (shadcn/ui), protobuf-es |
| `design-system/` | Design system sinh bằng ui-ux-pro-max (Newsreader + Roboto, đỏ breaking / xanh link) |
| `docs/` | Thiết kế (`superpowers/specs`) và `AI-AGENT-PLAYBOOK.md` (prompt cho Codex) |

```
Reader browser ──HTML (SSR)──> Express SSR :4300 ──protobuf──> service :8090 ──> Oracle ADB
      │  └─/api, /sitemap.xml, /rss.xml, /robots.txt (proxy, X-Forwarded-For) ─┘
      └─ ipinfo.io/json ──> POST /api/v1/public/reads (ReadEvent protobuf)
```

## Chạy local

```bash
docker compose up -d                       # Oracle 23ai Free trên localhost:1523 (user/pass news/news)

cd kira-news-247-service
NEWS_DB_URL=jdbc:oracle:thin:@localhost:1523/FREEPDB1 \
NEWS_ADMIN_USERNAME=owner  NEWS_ADMIN_PASSWORD='<>=12 ký tự>' \
NEWS_EDITOR_USERNAME=codex NEWS_EDITOR_PASSWORD='<>=12 ký tự>' \
JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn spring-boot:run      # :8090, Flyway tạo schema + 8 chuyên mục

cd ../kira-news-247-ui
npm install
npm start                                  # dev :4300, proxy /api → :8090 (proxy.conf.json)
# hoặc SSR thật:
npx ng build && NEWS_API_ORIGIN=http://localhost:8090 node dist/kira-news-247-ui/server/server.mjs
```

Tài khoản ADMIN/EDITOR chỉ được tạo ở lần khởi động đầu (khi chưa tồn tại). Biến môi trường: xem `.env.example`.

## Oracle Autonomous Database

1. Tạo ADB, tải **wallet** (Instance wallet), giải nén vào ví dụ `/opt/wallet`.
2. Tạo user ứng dụng (ví dụ `NEWS`) với quyền `CREATE SESSION, CREATE TABLE, CREATE SEQUENCE` và quota tablespace `DATA`.
3. Cấu hình service:
   - `NEWS_DB_URL=jdbc:oracle:thin:@<dbname>_high?TNS_ADMIN=/opt/wallet`
   - `NEWS_DB_USERNAME=NEWS`, `NEWS_DB_PASSWORD=...`
   (`oraclepki` đã có trong `pom.xml` cho wallet mTLS; nếu bật TLS một chiều thì dùng connect string TLS, không cần wallet.)
4. Flyway tự chạy `db/migration` khi khởi động.

## Production checklist

- `SITE.url` trong `kira-news-247-ui/src/app/core/site.ts` = domain thật (canonical, OG, JSON-LD) và `NEWS_SITE_URL` cho service
  (sitemap/RSS) phải trùng nhau. `ipinfoToken` đặt token ipinfo (token này lộ ra trình duyệt theo thiết kế).
- SSR: `NG_ALLOWED_HOSTS=<domain>` (Angular 21 chặn Host lạ), `NEWS_API_ORIGIN=http://<service nội bộ>`.
- Service: `NEWS_COOKIE_SECURE=true` sau HTTPS. **Không mở port service ra Internet**: service tin `X-Forwarded-For` từ
  SSR proxy (`NEWS_FORWARD_HEADERS=framework`).
- Mật khẩu ADMIN/EDITOR ≥ 12 ký tự; đăng nhập sai 5 lần khóa 15 phút (bộ đếm in-memory/instance).
- SSR ghi đè `X-Forwarded-For` bằng IP thật của kết nối. Nếu đặt nginx/LB trước SSR, đặt `TRUST_PROXY` (ví dụ `1`
  hoặc `loopback`) để lấy IP người đọc từ proxy đó.
- **Rate-limit `/api/v1/public/reads` theo IP ở nginx** trước khi mở công khai: beacon là công khai, chống trùng lượt xem
  chỉ dựa trên `visitor_id` do trình duyệt gửi. Service từ chối body > 1 MB (413).

## API (protobuf, `/api/v1`)

| Method | Path | Request → Response | Quyền |
|---|---|---|---|
| GET | `/public/home` | → `HomePage` | công khai |
| GET | `/public/articles?category=&page=&size=` | → `ArticlePage` | công khai |
| GET | `/public/articles/{slug}` | → `ArticleDetail` | công khai |
| GET | `/public/search?q=` | → `ArticlePage` | công khai |
| GET | `/public/categories` | → `CategoryList` | công khai |
| POST | `/public/reads` | `ReadEvent` → 204 | công khai (không CSRF) |
| POST | `/auth/login` · `/auth/logout` · GET `/auth/me` | `LoginRequest` → `Me` | — |
| GET/POST | `/admin/articles` | `ArticleDraft` → `AdminArticle` / → `AdminArticlePage` | ADMIN, EDITOR |
| GET/PUT | `/admin/articles/{id}` | `ArticleDraft` (kèm `version`) → `AdminArticle` | ADMIN, EDITOR |
| POST | `/admin/articles/{id}/transitions` | `TransitionRequest` → `AdminArticle` | theo workflow |
| POST | `/admin/articles/{id}/comments`, `/comments/{cid}/resolve` | → `AdminArticle` | ADMIN, EDITOR |
| GET | `/admin/articles/{id}/revisions/{n}` | → `Revision` | ADMIN, EDITOR |
| GET | `/admin/dashboard`, `/admin/reads` | → `Dashboard`, `ReadPage` | ADMIN |
| POST/PUT | `/admin/categories[/{id}]` | `CategoryDraft` → `Category` | ADMIN |

Lỗi luôn là `ApiError {code, message, trace_id}` với HTTP status tương ứng.

### Workflow

`DRAFT → IN_REVIEW → (CHANGES_REQUESTED ⇄ IN_REVIEW) → PUBLISHED → ARCHIVED`, thêm `REJECTED`.
AI (EDITOR) chỉ có `SUBMIT`; gửi lại bị chặn khi còn góp ý chưa xử lý. Admin `REQUEST_CHANGES` cần ít nhất một góp ý mở
(hoặc ghi chú đi kèm). Mỗi lần lưu nội dung tạo một `article_revision`.

## Kiểm thử

```bash
cd kira-news-247-service
JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn test -Dtest='ArticleWorkflowTest,ArticleDraftsTest,SlugsTest,MarkdownTest'
JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn test -Dtest=NewsFlowIT     # Oracle thật qua Testcontainers

cd ../kira-news-247-ui
npx ng test --watch=false --include=src/app/admin/front-matter.spec.ts
```

Đổi contract: sửa `proto/kira/news/v1/news.proto` → `npm run gen:proto` (UI) → `mvn compile` (service).
