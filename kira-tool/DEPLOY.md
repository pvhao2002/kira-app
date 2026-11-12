# Hướng dẫn deploy kira-tool

Tài liệu cho `kira-tool-service` (Node.js >= 22.18, Express 5, patchright, SQLite tích hợp `node:sqlite`) và
`kira-tool-ui` (Angular 22).
Tool chạy **public, không login**. Mỗi trình duyệt được cấp cookie `tool_owner` riêng và chỉ thấy job của mình.

---

## 1. Lưu ý quan trọng (đọc trước)

1. **Bắt buộc HTTPS.** Cookie `tool_owner` và `TOOL-XSRF-TOKEN` có cờ `Secure`, nên chạy qua HTTP thì trình duyệt
   không gửi cookie. Kết quả là mọi POST/DELETE bị 403 và danh sách job reset sau mỗi request.
   Chỉ dùng `TOOL_COOKIE_SECURE=false` khi chạy local bằng HTTP.
2. **nginx phải GHI ĐÈ `X-Forwarded-For`:** `proxy_set_header X-Forwarded-For $remote_addr;`.
   - Không dùng `$proxy_add_x_forwarded_for`, vì kiểu nối thêm này cho client tự giả IP và lách rate limit
     (10 job/phút/IP).
3. **nginx phải kết nối tới service từ IP private hoặc loopback** (127.x, 10.x, 172.16–31.x, 192.168.x).
   - Service (Express `trust proxy` = `loopback, linklocal, uniquelocal`) chỉ tin `X-Forwarded-For` từ các dải này.
   - Nếu nginx nằm ở host public khác, header bị bỏ qua và mọi người dùng chung một quota rate limit (IP của nginx).
   - Nếu service mở thẳng ra internet không qua nginx, đặt `TOOL_FORWARD_HEADERS=none`.
4. **Chỉ chạy 1 instance.** Rate limit, chống trùng job và SQLite đều nằm trong một process Node. Chạy 2 replica sẽ
   hỏng dedupe và hai instance tranh cùng file DB.
5. **UI và API phải cùng origin** (cùng domain và port). Không có CORS. Cookie owner có `Path=/tool-service`, nên UI
   phải gọi API qua prefix `/tool-service/`.
6. **Gỡ hoặc chặn `kira-tool-service` cũ (`:1406`).** Service cũ không có auth: ai cũng list/tải/xoá file được và
   có lỗ SSRF. Khi chuyển nginx sang service mới, tắt service cũ hoặc chặn port `1406` ở firewall.
7. **Giữ 2 thư mục dữ liệu qua các lần deploy:** `TOOL_DATA_DIR` (SQLite DB `tool.db`) và `TOOL_STORAGE_DIR` (file PDF).
   Xoá chúng là mất toàn bộ job.
8. **Tài nguyên:** mỗi worker chạy một Chromium (khoảng 300–500 MB RAM). File PDF được dựng trong bộ nhớ của
   process Node, tối đa 100 MB. Với `TOOL_WORKERS=2`, dự trù tối thiểu **2 GB RAM** cho server.
9. **Không vượt captcha.** Service dùng patchright với cấu hình mặc định, không giải captcha, không giả user-agent hay
   fingerprint, không xoay proxy. Nếu nguồn hiện captcha / trang chặn bot, job FAILED ngay với `PROVIDER_BLOCKED`
   ("The source is blocking automated access right now. Try again later.").
10. **Public = ai cũng xài được server.** Theo dõi băng thông và CPU. Cần thì thêm `limit_req` ở nginx
   (mục 6). Người dùng tự chịu trách nhiệm bản quyền tài liệu họ tải.

---

## 2. Yêu cầu server

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| OS | Linux x86_64 (Ubuntu 22.04/24.04 khuyến nghị) | Playwright cần thư viện hệ thống cho Chromium |
| Node.js (service) | `>=22.18` | Cần trên server. Service chạy thẳng file `.ts` (type stripping), không có bước build |
| Node.js (UI) | `^22.22.3`, `^24.15.0` hoặc `>=26` | Chỉ cần ở máy build UI. Node 22.20 quá cũ cho Angular CLI |
| nginx | bất kỳ bản hiện hành | TLS + reverse proxy |
| Port | `1407` (nội bộ) | Không mở port này ra internet |

---

## 3. Build

### 3.1 Service (trên máy build)

```bash
cd kira-tool/kira-tool-service
npm ci
npm test                                   # 99 test phải pass
npm run typecheck                          # tsc --noEmit, không có lỗi
# Không có bước build: deploy chính các file src/, package.json, package-lock.json
```

### 3.2 UI (trên máy build)

```bash
cd kira-tool/kira-tool-ui
npm ci
npx ng test --watch=false                  # 35 test phải pass
npx ng build                               # mặc định là production
# -> dist/kira-tool-ui/browser/   (index.html + assets)
```

`<base href="./">` cộng với hash routing (`/#/`) cho phép serve UI ở bất kỳ path nào, ví dụ `/tool/`, mà không cần
cấu hình rewrite.

---

## 4. Cài đặt trên server

### 4.1 User và thư mục

```bash
sudo useradd --system --create-home --home-dir /opt/kira-tool --shell /usr/sbin/nologin kiratool
sudo mkdir -p /opt/kira-tool/{app,data,storage,ui}
sudo chown -R kiratool:kiratool /opt/kira-tool
sudo chmod 750 /opt/kira-tool/data /opt/kira-tool/storage
```

Copy `src/`, `package.json`, `package-lock.json` của service vào `/opt/kira-tool/app/`, rồi cài dependency runtime:

```bash
cd /opt/kira-tool/app
sudo -u kiratool -H npm ci --omit=dev      # chỉ express + patchright
```

Copy nội dung `dist/kira-tool-ui/browser/` vào `/opt/kira-tool/ui/`.

### 4.2 Google Chrome cho patchright (chạy 1 lần, và chạy lại mỗi khi đổi bản patchright)

Service khởi chạy Google Chrome thật (`channel: 'chrome'`), không dùng Chromium đóng gói. Cài bằng CLI của chính
patchright trong `app/node_modules`:

```bash
cd /opt/kira-tool/app
# Google Chrome Stable + thư viện hệ thống (cài toàn hệ thống, cần root)
sudo npx patchright install --with-deps chrome
```

Nếu bỏ qua bước này, mọi job sẽ lỗi vì không tìm thấy Chrome.

### 4.3 Biến môi trường

Không biến nào bắt buộc, tất cả đều có giá trị mặc định. Tạo `/opt/kira-tool/kira-tool.env` với
`chmod 640` và owner `root:kiratool`:

```ini
TOOL_PORT=1407
TOOL_DATA_DIR=/opt/kira-tool/data
TOOL_STORAGE_DIR=/opt/kira-tool/storage
TOOL_RETENTION_DAYS=7
TOOL_WORKERS=2
TOOL_JOB_TIMEOUT=PT10M
TOOL_HEADLESS=true
TOOL_COOKIE_SECURE=true
TOOL_FORWARD_HEADERS=native
```

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `TOOL_PORT` | `1407` | Port HTTP nội bộ |
| `TOOL_DATA_DIR` | `./data` | Thư mục file SQLite (`tool.db`) |
| `TOOL_STORAGE_DIR` | `./storage` | Thư mục PDF (`{jobId}.pdf`) |
| `TOOL_RETENTION_DAYS` | `7` | Số ngày giữ file. Job dọn dẹp chạy mỗi giờ |
| `TOOL_WORKERS` | `2` | Số job chạy song song (mỗi job một Chromium) |
| `TOOL_JOB_TIMEOUT` | `PT10M` | Thời gian tối đa một job (ISO-8601 dạng `PTnHnMnS`) |
| `TOOL_HEADLESS` | `true` | `true` trên server không có màn hình. Chỉ đặt `false` khi chạy dưới `xvfb-run` (image Docker đã làm sẵn) |
| `TOOL_COOKIE_SECURE` | `true` | `false` chỉ dùng cho HTTP local |
| `TOOL_FORWARD_HEADERS` | `native` | `none` nếu không có reverse proxy |

Các giới hạn cố định trong code: hàng chờ 20 job, file tối đa 100 MB, mỗi cookie tối đa 3 job đang chạy,
body request tối đa 4 KB, URL tối đa 2048 ký tự.

### 4.4 systemd

`/etc/systemd/system/kira-tool.service`:

```ini
[Unit]
Description=kira-tool-service
After=network-online.target
Wants=network-online.target

[Service]
User=kiratool
Group=kiratool
WorkingDirectory=/opt/kira-tool
EnvironmentFile=/opt/kira-tool/kira-tool.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/kira-tool/app/src/server.ts
Restart=on-failure
RestartSec=5
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/kira-tool

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kira-tool
journalctl -u kira-tool -f
```

Khi restart, job đang `RUNNING` được tự đưa lại vào hàng chờ, và chuyển sang `FAILED/INTERRUPTED` sau 3 lần.

---

## 5. nginx

### 5.1 Server riêng cho tool (khuyến nghị)

```nginx
limit_req_zone $binary_remote_addr zone=kiratool:10m rate=5r/s;

upstream kira_tool_service_upstream {
  server 127.0.0.1:1407;
  keepalive 16;
}

server {
  listen 443 ssl http2;
  server_name tool.example.com;
  # ssl_certificate / ssl_certificate_key ...

  # UI tĩnh
  location / {
    root /opt/kira-tool/ui;
    try_files $uri $uri/ /index.html;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
  }

  # API
  location /tool-service/ {
    proxy_pass http://kira_tool_service_upstream;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;      # GHI ĐÈ, không dùng $proxy_add_x_forwarded_for
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 8k;                            # app chỉ kiểm Content-Length; chặn body chunked lớn ở đây
    proxy_read_timeout 300s;                            # tải PDF tối đa 100 MB
    limit_req zone=kiratool burst=20 nodelay;
  }
}

server {
  listen 80;
  server_name tool.example.com;
  return 301 https://$host$request_uri;
}
```

### 5.2 Hoặc dùng chung nginx của kira-app (`nginx/templates/kira-services.conf.template`)

Template hiện có đã có `location /tool-service/` trỏ tới `kira_tool_service_upstream`, đang dùng `:1406` của service cũ.
Các bước chuyển sang service mới:

1. Đặt `KIRA_TOOL_SERVICE_PORT=1407`, và `KIRA_TOOL_SERVICE_HOST` là host chạy service mới.
2. Thêm vào `location /tool-service/` các dòng `proxy_set_header X-Forwarded-For $remote_addr;`,
   `client_max_body_size 8k;` và `proxy_read_timeout 300s;`.
3. Serve UI ở một path riêng, vì `location /` đang thuộc kira-ui:
   ```nginx
   location /tool/ {
     alias /opt/kira-tool/ui/;
     try_files $uri $uri/ /tool/index.html;
   }
   ```
   Truy cập qua `https://<domain>/tool/`.
4. Tắt service cũ `:1406` (xem lưu ý 6).

> Thay đổi này sửa file nginx dùng chung của kira-app, nên chỉ làm khi đã sẵn sàng thay service cũ.

---

## 6. Kiểm tra sau deploy

```bash
# 1. Có cookie owner và CSRF, trả về danh sách rỗng
curl -si https://tool.example.com/tool-service/api/v1/jobs | grep -Ei '^(HTTP|set-cookie)'
#   HTTP/2 200
#   set-cookie: TOOL-XSRF-TOKEN=...; Path=/; Secure; SameSite=Strict
#   set-cookie: tool_owner=<uuid>; Max-Age=2592000; Path=/tool-service; Expires=...; HttpOnly; Secure; SameSite=Strict

# 2. POST không có CSRF thì bị chặn
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
  -d '{"url":"https://drive.google.com/file/d/x/view"}' https://tool.example.com/tool-service/api/v1/jobs
#   403

# 3. Port nội bộ không truy cập được từ ngoài
curl -s -m 5 http://<public-ip>:1407/ || echo "OK: port 1407 không public"
curl -s -m 5 http://<public-ip>:1406/ || echo "OK: service cũ không public"
```

Sau đó mở UI trên trình duyệt:

- [ ] Gửi một link Google Drive **public**: job chạy QUEUED, RUNNING rồi SUCCEEDED, và tải được PDF.
- [ ] Gửi một link Scribd public: job SUCCEEDED.
- [ ] Gửi một link Drive **private**: job FAILED với thông báo "file not public".
- [ ] Mở trình duyệt khác hoặc cửa sổ ẩn danh: danh sách job trống (đúng, vì job tách theo cookie).
- [ ] Log (`journalctl -u kira-tool`) chỉ có `jobId/provider/status/errorCode/durationMs`, không có URL hay cookie.

> Extractor Drive/Scribd **chưa được test với site thật** (test dùng extractor giả). Lần chạy đầu cần theo dõi kỹ.
> Nếu site đổi giao diện, job sẽ FAILED với `PROVIDER_EXTRACTION_FAILED`. Nếu nguồn hiện captcha / trang chặn bot,
> job FAILED với `PROVIDER_BLOCKED` (không có cơ chế vượt captcha, thử lại sau).

---

## 7. Cập nhật và rollback

```bash
# Backup trước khi cập nhật
sudo systemctl stop kira-tool
sudo tar czf /opt/kira-tool-backup-$(date +%F).tgz -C /opt/kira-tool data app ui
# Thay code service / ui
sudo rsync -a --delete kira-tool-service/src/ /opt/kira-tool/app/src/
sudo cp kira-tool-service/package.json kira-tool-service/package-lock.json /opt/kira-tool/app/
sudo rsync -a --delete dist/kira-tool-ui/browser/ /opt/kira-tool/ui/
sudo chown -R kiratool:kiratool /opt/kira-tool
(cd /opt/kira-tool/app && sudo -u kiratool -H npm ci --omit=dev)
sudo systemctl start kira-tool
```

- **Rollback:** stop service, giải nén lại file backup, rồi start.
- **Schema:** `src/schema.sql` chạy mỗi lần start với `CREATE TABLE IF NOT EXISTS`. Thay đổi schema chỉ được *thêm*
  (`ALTER TABLE ... ADD COLUMN`, kiểm tra cột đã có trước vì SQLite không có `IF NOT EXISTS` cho cột), không sửa câu lệnh cũ.
- **Nâng patchright:** chạy lại mục 4.2 sau khi `npm ci` cài version mới.

---

## 8. Giới hạn đã biết (`ponytail:` trong code)

| Giới hạn | Khi nào cần xử lý |
|---|---|
| Rate limit và dedupe nằm trong memory, chỉ đúng với 1 instance | Khi cần >1 replica: chuyển sang Redis hoặc khoá DB, và chuyển SQLite sang MySQL |
| Giới hạn 3 job đang chạy tính theo cookie, xoá cookie là lách được. Chỉ còn hàng chờ 20 job chặn chung | Khi có người spam lấp hàng chờ: lưu IP vào job và giới hạn theo IP |
| Chặn SSRF chỉ dựa vào tên miền, không phân giải DNS (`127.0.0.1.nip.io` vẫn qua) | Khi server nằm chung mạng với hệ thống nhạy cảm: thêm egress firewall cho Chromium |
| PDF dựng trong bộ nhớ process Node (tối đa 100 MB) | Khi gặp OutOfMemory: stream PDF ra file tạm |
| Nhận diện captcha / trang chặn bot dựa trên danh sách dấu hiệu (URL, title, iframe, câu chữ) | Khi nguồn đổi trang chặn: bổ sung dấu hiệu trong `src/browser.ts` |
| File `.tmp` sót lại khi crash không được dọn | Khi dung lượng `storage/` tăng bất thường: xoá `*.tmp` cũ hơn 1 ngày bằng cron |
| Mất cookie là mất danh sách job | Chấp nhận, vì tool không có tài khoản |
