# MatchMind — Backlog (UX review)

Nguồn: UX Reviewer (Agent 1), vòng 1 đến 8 (UX-043..UX-061 ở section "Vòng 2", UX-062..UX-071 ở "Vòng 3", UX-072..UX-083 ở "Vòng 4", UX-084..UX-096 ở "Vòng 5", UX-097..UX-108 ở "Vòng 6", UX-109..UX-119 ở "Vòng 7", UX-120..UX-125 ở "Vòng 8" cuối file), 2026-11-20. Môi trường: compose stack `http://localhost:8088`, tài khoản admin,
desktop 1440px và mobile 390px. Ảnh minh hoạ ở `docs/backlog-screenshots/`.
Các agent khác ghi vào file này dưới section riêng của mình, không ghi đè.

Quy ước: Severity = Blocker / High / Medium / Low. Type = Bug / Missing feature / UX / Perf / A11y / Security.
Effort = S (< 0,5 ngày) / M (0,5–2 ngày) / L (> 2 ngày). Mục nào đổi API contract được ghi rõ "đổi contract".

## Bảng ưu tiên (cập nhật mỗi vòng)

| ID | Sev | Type | Màn hình | Tóm tắt | Effort |
|---|---|---|---|---|---|
| UX-001 | High | Missing feature | Match detail | Không có cách nhập/sửa kết quả trận trên UI, flow import → settle bị cắt giữa chừng (đổi contract) | M |
| UX-002 | Medium | Security / UX | Toàn app | Dữ liệu E2E tồn đọng: 28 model/provider, ~20 user viewer đang Active, không có archive/xoá | M |
| UX-003 | Medium | UX | Match detail | "Result history" hiển thị JSON thô | S |
| UX-004 | Medium | UX | Prediction detail | Chi tiết settle của pick là JSON thô, không có lời giải thích dễ đọc | M |
| UX-006 | Medium | Bug / UX | Reports | Cột Wins/Losses trùng với Half wins/Half losses, tổng không khớp Settled | S |
| UX-009 | Medium | UX | Reports > Model comparison | Mặc định "ít nhất 2 model" nên tab trống dù có dữ liệu | S |
| UX-010 | Medium | UX | Mọi danh sách | Filter không nằm trên URL, reload là mất, không chia sẻ được link | M |
| UX-011 | Medium | UX / A11y | Predictions, Models, Reports | Cột quan trọng (Result) nằm ngoài khung nhìn; mobile chỉ thấy Date + Match | M |
| UX-012 | Medium | UX | API Logs | Cột Error (lý do reject) bị cắt, phải cuộn ngang mới thấy | S |
| UX-013 | Medium | Security | API Logs / Auth | Client IP ghi nhận là `172.21.0.1` (gateway docker), cần xác nhận X-Forwarded-For sau nginx | S |
| UX-018 | Medium | Missing feature | Dashboard / Models | Không có ROI/profit, không có cảnh báo mẫu nhỏ, không có calibration | L |
| UX-026 | Medium | Security | API Logs / Auth | Role VIEWER đọc được toàn bộ API Logs (IP, endpoint, lỗi), providers, export CSV; menu API Logs vẫn hiện cho viewer | S |
| UX-027 | Medium | Security | Agent API | Một `EXTERNAL_API_KEY` chung cho mọi agent; provider/model tự khai; cùng key ghi được kết quả trận (agent tự chấm điểm), không xoay/thu hồi theo provider | L |
| UX-028 | Medium | Bug / Data integrity | Import / API | `predictedAt` tương lai (+10 năm) và PRE_MATCH có `predictedAt` sau giờ đá đều được nhận, làm sai thứ tự "latest" và thổi phồng win rate | S |
| UX-033 | Medium | UX | Import | Ô Provider/Model/Version ghi đè im lặng `model` trong JSON; gõ sai tạo model mới ("OTHER 9"), không xem trước/không chọn từ danh sách | S |
| UX-034 | Medium | UX / Audit | Prediction detail | Recalculate khi kết quả không đổi: toast "Recalculated" nhưng không ghi history, lý do bị bỏ; Override chỉ ghi "Admin override" không có tên admin | S |
| UX-035 | Medium | UX | Toàn app | Mở link ở tab mới / Ctrl+click bắt đăng nhập lại (JWT ở sessionStorage); hết phiên mất `returnUrl` | M |
| UX-036 | Medium | A11y | Layout (mobile) | Drawer mobile: Esc không đóng, focus không vào/không bị giữ trong drawer, link của drawer đóng vẫn Tab tới được; nút menu thiếu `aria-expanded` | S |
| UX-037 | Medium | UX | Mọi danh sách / dashboard | Trạng thái lỗi không có nút Retry, thông báo nhỏ ở chân bảng ("0–0 of 0"); 413/offline chỉ "Request failed" | S |
| UX-038 | Medium | UX | Matches | Cột League không giới hạn chiều rộng, đẩy Score/Status/Predictions ra khỏi màn hình; tên đội dài bị cắt không có tooltip | S |
| UX-039 | Medium | Missing feature | Dashboard (lần đầu) | Không có hướng dẫn bắt đầu: sổ trống chỉ ghi "No predictions yet." | S |
| UX-045 | High | Bug / Data integrity | Import / API | Cùng provider + `externalMatchId` nhưng payload sau có đội/giải khác: match bị ghi đè im lặng (prediction cũ bị gắn vào "trận khác"), không có cảnh báo hay audit (vòng 2) | S |
| UX-051 | High | UX / Data integrity | Match detail, Prediction detail, Reports | Sửa kết quả trận sau khi settle: Match detail vẫn hiện "Full time 1:1" cùng "Win 2/0 100%"; cảnh báo "Needs review" chỉ ở Dashboard, không có badge nav/detail/report, không có "Recalculate all" (vòng 2) | M |
| UX-063 | High | Bug / Data integrity | Agent API `matches/results` | `resultAt` tương lai (2036) được nhận rồi chặn mọi kết quả đúng sau đó bằng `409 STALE_RESULT`, admin không sửa được qua UI; `FINISHED` cho trận chưa đá cũng được settle luôn (vòng 3) | S |
| UX-080 | High | Bug | Matches, Predictions, API Logs, Reports (Rows per page) | Đổi "Rows per page" làm hỏng mọi danh sách: "NaN–NaN of 375", select trống, rồi bấm Next ra `page=NaN` (400) và "Page NaN of NaN"; chỉ F5 mới hết. Nguyên nhân: output `change` của `mm-paginator` trùng sự kiện DOM `change` nổi bọt từ `<select>` (vòng 4) | S |
| UX-084 | High | Bug / Data integrity | Agent API + Matches, Predictions, AI Models, Match detail | `startTime`/`predictedAt`/`resultAt` dạng số (epoch ms `1796000000000`) được nhận như epoch giây, lưu thành năm 58882; một dòng đó làm trang Matches, Predictions và AI Models ném `RangeError: Invalid time value`, bảng trống "0–0 of 0" cho mọi người, vì dòng độc nằm đầu danh sách sắp xếp theo ngày giảm dần (vòng 5) | S |
| UX-098 | High | Bug / Data integrity | Agent API + Matches, Prediction detail (Odds) | Các lối còn lại của UX-084: `odds[].capturedAt` dạng số làm tab Odds render dở (1/4 dòng) kèm `RangeError`; `startTime` ISO năm ≥ 10000 (`+10000-01-01T00:00:00Z`) được nhận, JSON trả `+10000-…` mà `new Date()` từ chối, nên Matches trống cho mọi người; năm 0001 lưu thành 0001-01-03; không có cửa sổ ngày hợp lệ (vòng 6) | S |
| UX-103 | High | Missing feature / Flow | Agent API, Prompts, Match detail | Prompt bảo agent bỏ `eventId`/`externalMatchId` (server sinh `auto-<hash>`), nhưng `matches/results` bắt buộc `externalMatchId`, prompt chỉ yêu cầu báo `predictionId`+`duplicate`, UI không nhập được kết quả: luồng chính không có đường nào đưa kết quả vào ngoài việc người dùng tự chép id `auto-…` (vòng 6) | M |
| UX-047 | Medium | Missing feature | Import / API / Reports | Không có định danh trận xuyên provider: cùng một trận thật, 2 agent dùng 2 `externalMatchId` thành 2 trận, nên "Model comparison" không so sánh được (vòng 2) | L |
| UX-046 | Medium | Bug / Data integrity | Import / API | Cùng model + match + loại + pick, chỉ khác `eventId` thì lưu thêm một prediction mới: win rate bị nhân đôi (vòng 2) | M |
| UX-043 | Medium | Security | Login | Khoá đăng nhập theo username (5 lần sai = 15 phút, kể cả mật khẩu đúng): ai cũng khoá được `admin`; admin không có nút mở khoá (vòng 2) | S |
| UX-044 | Medium | UX / Security | Settings > Users | Đổi role bằng `<select>`: Viewer thành Admin chỉ một lần chọn, không xác nhận, không toast, không audit (vòng 2) | S |
| UX-048 | Medium | UX / Data loss | Prompts (và mọi form) | Hết phiên khi đang sửa Prompt: hộp native "Discard your unsaved changes?" chặn redirect; bấm Cancel thì UI "zombie" (header "Viewer", nút Save còn, không báo gì) (vòng 2) | S |
| UX-049 | Medium | Perf | Dashboard, Predictions (live) | Mỗi sự kiện SSE gọi lại `/dashboard` và `/predictions`: 12 import cùng lúc = 24 request, không debounce, toast riêng từng cái (vòng 2) | S |
| UX-050 | Medium | Missing feature | Match detail | Chỉ thấy prediction mới nhất của mỗi model; các prediction còn lại (Predictions = 2) không có link, không có timeline "Prediction history" như plan.md §8 (vòng 2) | M |
| UX-054 | Medium | Bug / Cần xác minh | API / nginx | Preflight CORS tới `/api/v1/external/**` từ origin lạ (vd `https://claude.ai`) trả 403 trên stack đang chạy, trong khi code/doc nói "mở"; flow artifact trong browser sẽ không gọi được (vòng 2) | S |
| UX-061 | Medium | Missing feature | Providers | Không chặn/tắt được một agent (plan.md §12: enable/disable, rotate, revoke); chỉ có một key chung nên chỉ còn cách đổi `EXTERNAL_API_KEY` cho tất cả (vòng 2) | M |
| UX-062 | Medium | Security | Settings > Change password | `POST /auth/change-password` không giới hạn thử: 12 lần sai liên tiếp đều 400 trong 2,6 s, token bị đánh cắp dò được mật khẩu hiện tại; mật khẩu mới trùng cũ vẫn được nhận và đăng xuất mọi phiên (vòng 3) | S |
| UX-064 | Medium | Security | SSE `/events/predictions` | Luồng SSE đang mở không bị đóng khi token bị thu hồi: user vừa Disable vẫn nhận sự kiện prediction mới; không có giới hạn tuổi thọ luồng (vòng 3) | S |
| UX-065 | Medium | Data integrity | Prediction detail / API | Override cho pick của trận còn `SCHEDULED` (kể cả `startTime` năm 1970) được nhận: pick hiện Win và vào win rate khi trận chưa có kết quả; lý do không nằm trong response (vòng 3) | S |
| UX-067 | Medium | Bug / Config | Prompts | Template cứng URL production `https://match.kira.id.vn/...`: Copy từ bản local/staging gửi dữ liệu và key sang prod; không có template nào hướng dẫn agent gửi `matches/results` (vòng 3) | S |
| UX-072 | Medium | Security | nginx + API (login, `/external/**`) | `real_ip_header X-Forwarded-For` tin XFF của client từ dải `172.16/12` và `192.168/16`: gửi `X-Forwarded-For` giả thì `clientIp` trong API Logs bị giả (`203.0.113.77`), `limit_req` của nginx bị vượt (100 request XFF ngẫu nhiên đều qua, cùng IP thì 27/100 bị 429), bộ đếm IP của login cũng bị né (vòng 4) | S |
| UX-073 | Medium | Security / Perf | Agent API, API Logs | Request không có/sai API key cũng ghi 1 dòng `api_logs` mỗi lần (61 lần sai key = 61 dòng, 0 ms/dòng), không giới hạn; gặp XFF giả (UX-072) thì ngập log, che lỗi thật của agent (vòng 4) | S |
| UX-074 | Medium | Bug / UX | Login | Giới hạn IP của login (20 lần/5 phút) đếm cả lần đăng nhập thành công và dùng chung một IP (`172.21.0.1`): vài lần thử sai + vài phiên đăng nhập là cả `admin` lẫn user chưa từng sai bị `429 LOGIN_RATE_LIMITED` ~3 phút (vòng 4) | S |
| UX-075 | Medium | UX / Data | Predictions, Dashboard, Reports | Bộ lọc/cột "Result" ở Predictions chỉ tính pick đầu (top pick): lọc "Win" ra 5 dòng trong khi Dashboard và Reports ghi 35 Win; không có chú thích đơn vị (prediction hay pick) (vòng 4) | S |
| UX-081 | Medium | Missing feature | Model detail | Trang model là ngõ cụt: chỉ 15 prediction mới nhất (model có 301), không có link "Xem tất cả", không có biểu đồ win rate theo thời gian; thẻ Win rate to "100.0%" chỉ từ 1 pick, không cảnh báo mẫu nhỏ (vòng 4) | M |
| UX-085 | Medium | UX | Agent API (lỗi validation) | `startTime` không có offset (`2026-12-05T20:00:00`, kiểu agent hay gửi) trả `400 INVALID_FIELD_TYPE` "A field has the wrong type or format" / "wrong type or format", không nói định dạng mong đợi (vòng 5) | S |
| UX-086 | Medium | UX / Data | Predictions, Matches, Dashboard, Reports (filter League) | Filter League khớp chính xác và phân biệt hoa thường: `ux league r2` hoặc thừa một dấu cách ra 0 dòng không báo gì; league do agent tự gõ nên cùng một giải thành nhiều tên, không có gộp/alias (vòng 5) | S–L |
| UX-088 | Medium | Security / Data integrity | DB (`predictions`, `prediction_pick_results`) | Bất biến/append-only chỉ ở tầng Java: không có trigger, role app có `UPDATE`/`DELETE`; tôi sửa được `predicted_at` của một prediction bằng một câu `UPDATE` thường. Trái quy tắc "Integrity lives in the database too" (vòng 5) | M |
| UX-090 | Medium | UX / Security | Đăng xuất | "Sign out" ở một thiết bị thu hồi MỌI phiên của user (kiểm bằng 2 token của cùng user: logout A thì B cũng 401); không có chữ báo "everywhere", gộp với UX-048 là mất dữ liệu đang sửa ở thiết bị kia (vòng 5) | S–M |
| UX-091 | Medium | Bug / UX | Prompts (Copy), mọi nút Copy | Không có fallback khi `navigator.clipboard` không tồn tại (HTTP không phải localhost/HTTPS, ví dụ `http://192.168.x.x:8088`): toast bảo "copy thủ công" nhưng bản có API key không hiển thị ở đâu để chọn. Suy ra từ code, chưa chạy trên HTTP LAN (vòng 5) | S |
| UX-095 | Medium | UX | Predictions, Picks tab, Dashboard | Pick LIVE `REMAINING_MATCH` hiện "OU OVER 2.5 · Live · 2:1 · Loss" mà không nói tính trên bàn thắng sau phút 55; chỉ tab Odds có cột Basis. Trông như engine sai (vòng 5) | S |
| UX-097 | Medium | Data integrity / Bug | Agent API, Reports, Dashboard | Một prediction nhồi 20 pick (nhiều pick trùng hệt nhau) = 20 pick tính vào win rate: model `r6-model` 1 prediction, 20 pick, 17 Win, win rate 100%; không khử trùng, không trần "top 2" như plan.md/prompt, win rate tính theo pick không theo prediction (vòng 6) | S–M |
| UX-099 | Medium | UX / Data | Matches, Predictions (ô Search) | Search phân biệt dấu: `atletico`, `munchen`, `nandu` ra 0 dòng với "Atlético Madrid" / "Bayern München" / "Ñandú"; NFC/NFD cũng khác nhau (vòng 6) | S |
| UX-104 | Medium | Data integrity / Missing feature | Agent API (match tự nhận diện theo tên đội), Matches | Tên đội không chuẩn hoá khoảng trắng trong, dấu, hậu tố FC: 6 cách viết "Atlético Madrid" ra 5 trận; không có công cụ gộp trận (vòng 6) | M |
| UX-110 | Medium | UX | Matches, Predictions, Dashboard, Reports (bộ lọc ngày) | Chỉ điền "From" hoặc chỉ "To" lọc đúng MỘT ngày, không phải "từ ngày đó trở đi / đến ngày đó"; trang Matches không kiểm `from > to` (im lặng "No matches"), khác bốn trang dùng filter bar có báo lỗi inline (vòng 7) | S |
| UX-113 | Medium | Missing feature / Flow | Dashboard, Matches | Không có hàng đợi "chờ kết quả": 414/533 pick Pending, trận LIVE từ hôm qua vẫn "Live" mãi, không có nhãn quá hạn, "340 pending" ở hero và thẻ KPI không phải link, bộ lọc Matches không chọn được "đã quá giờ đá, chưa có kết quả" (cộng UX-103 là không có đường xử lý) (vòng 7) | M |
| UX-119 | Medium | Missing feature / Docs | Prompts (Settlement), Match detail | Prompt settlement (plan.md §11, mẫu 2) dựa vào đầu vào "pick id + kết quả" nhưng không có nút/API nào xuất sẵn; template v42 còn đuôi `<!-- e2e mwn2t01l -->` và thiếu 422 `PICK_NOT_IN_MATCH`, `FINAL_BELOW_CAPTURE_SCORE` (vòng 7) | M |
| UX-120 | Medium | Bug / A11y | Mọi dialog (`mm-dialog`: API Logs, Settings, Override, Confirm) | Phím Esc không đóng dialog ngay: handler `(cancel)="!closable() && $event.preventDefault()"` trả `false` nên Angular tự `preventDefault()`; Esc phải bấm 2 lần (có lúc không đóng); Raw `<dialog>` đóng ngay ở lần 1 (vòng 8) | S |
| UX-121 | Medium | Perf | nginx (web + proxy `/api`) | Không bật gzip/brotli: `main-*.js` 295 044 B truyền nguyên, `GET /predictions?size=100` 87 137 B JSON thô dù gửi `Accept-Encoding: gzip`; `nginx.conf` không có `gzip` (vòng 8) | S |
| UX-122 | Low | Security / Ops | API response qua nginx | Header bảo mật bị lặp và mâu thuẫn: `Content-Security-Policy` 2 giá trị (một của Spring `default-src 'self'; object-src 'none'`, một của nginx cho SPA), `X-Frame-Options`, `X-Content-Type-Options` mỗi cái 2 lần (vòng 8) | S |
| UX-123 | Low | A11y | Router / Shell | Đổi trang bằng link nội bộ không dời focus và không báo screen reader: sau khi bấm "Predictions" focus vẫn ở link sidebar, không có route announcer, `<h1>` không nhận focus (vòng 8) | S |
| UX-124 | Low | UX / Data loss | Auth (phiên 8 giờ) | JWT sống cố định 8 giờ (`exp - iat = 28800`), không gia hạn khi đang dùng, không cảnh báo trước khi hết hạn: đến giờ là bị đá ra `/login?expired=1` giữa lúc sửa (gộp UX-048) (vòng 8) | M |
| UX-125 | Low | A11y | Tabs (Reports, Match/Prediction detail, Settings) | Tab list chỉ hỗ trợ ←/→; Home/End không làm gì (APG tabs pattern); mũi tên chọn luôn (automatic activation) nên mỗi lần bấm tải lại một báo cáo (vòng 8) | S |
| UX-082 | Low | UX | Import (lần đầu dùng) | Trang Import dùng thuật ngữ `CANNOT_CALL_API`, `X-Model-Name` mà không nói lấy ở đâu; không link tới Prompt Notes, không có nút "Dùng ví dụ" dù `docs/samples/*.json` có sẵn (vòng 4) | S |
| UX-087 | Low | A11y / UX | Mobile (Settings, Match detail, bảng) | Bảng Users ở 390px cắt cột hành động (Disable/Reset) không có gợi ý cuộn; `<select>` role 12,8px và ô mật khẩu 14px làm iOS tự zoom; link/tiêu đề sort cao 19–21px (< 24px WCAG 2.5.8) (vòng 5) | S |
| UX-089 | Low | Security / Perf | SSE `/events/predictions` | Không giới hạn số luồng: 150 kết nối cùng một token VIEWER đều 200; `send()` chạy tuần tự trên thread của request agent (latency POST 0,02 s thành 0,064 s) (vòng 5) | S |
| UX-092 | Low | UX | Reports > Monte Carlo | KPI "Correct score accuracy 0.0%" không ghi mẫu (0 trúng / 26 trận đã xong / 34 mô phỏng) dù API trả `finishedPredictions`, `correctScoreHits` (vòng 5) | S |
| UX-093 | Low | UX | Import | Dấu nháy cong (`“ ”`) hoặc dấu phẩy thừa bị từ chối bằng thông báo parser thô; code fence, văn bản dẫn, BOM, CRLF thì được nhận (vòng 5) | S |
| UX-094 | Low | Docs / Ops | nginx, Swagger | `:8088/swagger-ui.html` và `/v3/api-docs` trả `index.html` với HTTP 200 (SPA fallback); Swagger tắt trong `.env`, doc/README ghi cổng khác nhau; plan.md §14 đòi OpenAPI (vòng 5) | S |
| UX-096 | Low | Bug | Import / Agent API | Tên đội chỉ gồm U+200B hoặc U+00A0 vượt qua `must not be blank` (đội "vô hình", link không có tên); xuống dòng/tab trong tên được lưu nguyên; surrogate lẻ được nhận (vòng 5) | S |
| UX-100 | Low | UX | Mọi bảng (điện thoại ngang 844x390) | Bộ lọc mở sẵn + header dính 60px + bảng cuộn lồng nhau: thấy đúng 1 dòng dữ liệu (vòng 6) | S |
| UX-101 | Low | UX / A11y | Dashboard (biểu đồ) | Đổi theme OS giữa phiên: thẻ đổi màu nhưng biểu đồ giữ màu cũ (lưới đen trên nền trắng); "Win rate by model" chỉ hiện 1 nhãn trục X cho 14 model (vòng 6) | S |
| UX-102 | Low | A11y / UX | Reports, mọi bảng | Handle đổi độ rộng cột chỉ dùng chuột (6px, `aria-hidden`, không bàn phím, `touch-action:auto`), không nhớ độ rộng; đổi số kết quả sau Apply/phân trang không được đọc (không `aria-live`) (vòng 6) | S |
| UX-108 | Low | Data integrity / UX | Agent API, AI Models | Tên model phân biệt hoa thường và dấu câu: `gpt-5.1`, `GPT-5.1`, `GPT 5.1`, `gpt-5.1-` thành 4 model riêng, không có rename/gộp/archive (vòng 6) | S–M |
| UX-105 | Low | UX / Audit | Agent API, Matches | Trận POSTPONED nhận prediction mới với giờ mới thì giữ nhãn Postponed, `startTime` đổi âm thầm, không có lịch sử dời lịch (vòng 6) | S |
| UX-106 | Low | UX / Docs | Agent API, Prompts | Cùng `eventId`, cùng instant nhưng khác dạng ghi (`.000Z`, `+07:00`) hoặc thừa một dấu cách = `409 EVENT_ID_REUSED`; prompt không dặn gì về 409/`MATCH_ALREADY_FINAL` (vòng 6) | S |
| UX-107 | Low | Dev | `ng serve` (proxy.conf.json) | Context proxy `/api` nuốt cả route SPA `/api-logs`: F5 ở `localhost:4201/api-logs` ra JSON 401 thô; nginx (`/api/`) thì đúng (vòng 6) | S |
| UX-109 | Low | UX | Dialog Add user, Override | Bấm đúp nút submit gửi 2 request: Add user ra `201` + `409` (lỗi bị nuốt), Override ra 2 POST `200` + 2 toast "Override saved" (DB chỉ 1 dòng lịch sử); nút không bị khoá trong lúc gửi (vòng 7) | S |
| UX-111 | Low | Bug / UX | Prediction detail, Match detail (điện thoại) | Chuỗi dài không có khoảng trắng (model 76, đội 134, league 135 ký tự; API cho tới 128/160) làm cả trang rộng 1871px ở 390px: tiêu đề `h2`, dòng phụ không có `overflow-wrap` (vòng 7) | S |
| UX-112 | Low | UX / i18n | Toàn app | Ngày giờ theo locale trình duyệt, chữ giao diện luôn tiếng Anh (`lang="en"`): vi-VN "17:00 29 thg 12, 2026", de-DE "29.12.2026", ar-EG chữ số Ả Rập; số thập phân luôn dấu chấm; không nhãn múi giờ (vòng 7) | S |
| UX-114 | Low | UX | Dashboard (Results) | Donut "Results" gồm cả Pending (340/358 pick): Win/Loss distribution (plan.md §7) không đọc được, 18 pick đã settle chỉ là vạch mảnh (vòng 7) | S |
| UX-115 | Low | A11y | Toast | Toast tự tắt sau 5 s (lỗi 8 s), không dừng khi hover/focus (WCAG 2.2.1); giữ tối đa 4 cái nên đợt import nhiều làm rơi toast cũ (vòng 7) | S |
| UX-116 | Low | UX | Prompts (editor) | Dán 250 000 ký tự: bộ đếm ghi "250000 characters" không nói giới hạn 200 000, nút Save vẫn bật, lỗi chỉ "Save failed / Request validation failed" (bỏ `fieldErrors`) (vòng 7) | S |
| UX-117 | Low | UX | Dashboard | Thẻ KPI (Predictions 347, Matches 103, Active models 15 / 48) chỉ tính trong 30 ngày mặc định nhưng không ghi khoảng ngày; trang Predictions ghi 438, Matches 174; thẻ không bấm được để xem danh sách (vòng 7) | S |
| UX-118 | Low | Data integrity | Agent API (provider vs model) | Tên provider không phân biệt hoa thường và được cắt khoảng trắng (`UX-Review-R7`, ` ux-review-r7 ` gộp vào một provider), còn tên model phân biệt (UX-108): hai quy tắc khác nhau cho cùng kiểu dữ liệu (vòng 7) | S |
| UX-005 | Low | UX | Detail pages | `<h1>` và `<title>` chung chung ("Match", "Prediction", "AI Model") | S |
| UX-007 | Low | Bug | Model detail, Prompts | Nhãn viết hoa sai: "Ah", "Corner ou", "Ou", "Ai prediction" | S |
| UX-008 | Low | UX | Predictions / detail | Cùng một line AH hiện 2 kiểu: `0/-0.5` (list) và `-0.25` (detail) | S |
| UX-014 | Low | UX | API Logs | Cột "Event id" chứa cả externalMatchId; import qua UI để trống | S |
| UX-015 | Low | UX | Import | Lỗi JSON sai nghĩa, form không reset sau khi lưu, không xem trước | S |
| UX-016 | Low | UX | AI Models | Không search/sort/paging; click hàng không mở detail (khác Predictions/Matches) | S |
| UX-017 | Low | UX | AI Models | Cùng model hiện 2 dòng vì version "1" và "1.0" | S |
| UX-019 | Low | Missing feature | (không có) | Không có màn Providers dù API `GET /providers` có sẵn | M |
| UX-020 | Low | Missing feature | Settings | Không có hướng dẫn kết nối agent (URL, headers, key); danh sách user không phân trang | S |
| UX-021 | Low | UX | Toàn app | Giờ hiển thị theo múi giờ trình duyệt, không ghi nhãn TZ | S |
| UX-022 | Low | UX | Dashboard | Biểu đồ rỗng không có thông báo "chưa có dữ liệu đã settle" | S |
| UX-023 | Low | UX | Router | URL lạ bị redirect im lặng về dashboard, không có trang 404 | S |
| UX-024 | Low | UX | Prediction detail > Odds | Cột Stage hiện "Opening 1", "Pre match 1", "Live 1" (số thứ tự snapshot dính vào nhãn) | S |
| UX-025 | Low | UX | Prediction detail > Stats, Monte Carlo | "Other stats" và "Probabilities" là JSON thô | S |
| UX-029 | Low | Bug | Import / API | Ký tự NUL trong text trả `409 DATA_CONFLICT` message rỗng (đáng ra 400); `homeTeam == awayTeam` được nhận | S |
| UX-030 | Low | Security | Hiển thị text agent | Ký tự BiDi (U+202E) đảo chiều tên đội hiển thị; HTML/CSV đã được escape/neutralise đúng | S |
| UX-031 | Low | Security | Users | Mật khẩu chỉ kiểm độ dài (`aaaaaaaaaa` được nhận); không có chính sách mật khẩu phổ biến | S |
| UX-032 | Low | UX | Override / Recalculate dialog | Focus đầu tiên rơi vào nút Close; nút submit disabled không giải thích; lý do 1 ký tự vẫn qua; không xem trước ảnh hưởng win rate | S |
| UX-040 | Low | A11y | Toàn app | Không có skip link; hàng bảng có 2 tab stop (TR + link); nút Disable/Reset/Recalculate lặp tên không kèm hàng; bảng không có tên; tablist thiếu aria-controls/Home/End; biểu đồ không có bảng số liệu thay thế; login thiếu `<main>` | M |
| UX-041 | Low | A11y | Matches, API Logs | Ở 320px có cuộn ngang cấp trang (scrollWidth 322 > 305) | S |
| UX-042 | Low | UX | Settings, Filters | Disable user không xác nhận và không toast; badge "Filters 2" đếm cả khoảng ngày mặc định; nút menu thừa ở desktop (đã có Collapse sidebar) | S |
| UX-052 | Low | Security / Audit | API Logs | Chi tiết log hiện Provider là UUID; import/settle/override qua UI không ghi admin nào làm (vòng 2) | S |
| UX-053 | Low | Security / Privacy | Toàn app | Font tải từ `fonts.gstatic.com` mỗi lần mở trang (rò IP cho bên thứ ba, hỏng khi offline); CSP phải mở `fonts.googleapis.com`, `style-src 'unsafe-inline'` (vòng 2) | S |
| UX-055 | Low | UX | Import | Dán 2 JSON hoặc mảng JSON: "The JSON is not valid JSON: Unexpected non-whitespace character after JSON at position 459"; không có import hàng loạt; lỗi API hiện mã thô và thiếu dấu câu (vòng 2) | S |
| UX-056 | Low | UX | Prompts | Hộp thoại native `confirm()` cho "Discard your unsaved changes?" thay vì dialog của kit; hiện cả khi bấm lại đúng template đang sửa (vòng 2) | S |
| UX-057 | Low | UX | Dashboard | "Latest predictions" bỏ năm: prediction đặt năm 2036 hiện "Nov 20, 05:00 PM" như hôm nay (vòng 2) | S |
| UX-058 | Low | A11y | Form control | Viền ô nhập 1,28:1 so với nền (WCAG 1.4.11 cần 3:1) (vòng 2) | S |
| UX-059 | Low | UX / Security | Settings > Users | Add user / Reset password: không hiện/ẩn mật khẩu, không sinh ngẫu nhiên, không bắt đổi ở lần đăng nhập đầu; admin biết mật khẩu người dùng (vòng 2) | S |
| UX-060 | Low | Missing feature | Prompts | Prompt có số version nhưng không có lịch sử/diff/khôi phục; viewer bấm Copy được prompt còn nguyên `{{EXTERNAL_API_KEY}}` mà toast vẫn báo "Prompt copied" (vòng 2) | M |
| UX-066 | Low | UX | Import | Nút Send bị khoá không giải thích (ô Model trống, placeholder `gpt-5.1` trông như đã điền); dán JSON kết quả trận bị từ chối với "UNKNOWN_FIELD: Unknown field 'externalMatchId' externalMatchId unknown field" (vòng 3) | S |
| UX-068 | Low | Security / API | Mọi API | Lỗi validation lộ tên lớp Java (`java.time.Instant`, `java.lang.String`) ở `/dashboard?from=`; lỗi 401/403 của Spring Security khác dạng JSON (thiếu `traceId`, charset ISO-8859-1) (vòng 3) | S |
| UX-069 | Low | Security / Ops | nginx + API | Header bảo mật bị lặp (CSP 2 bản, X-Frame-Options, nosniff đều 2 lần); không nén gzip/br (`main-*.js` 295 KB thô); chưa thấy HSTS (vòng 3) | S |
| UX-070 | Low | UX / A11y | Predictions, Settings, Login | Hai cột cùng tên "Predicted"; ký hiệu thiếu giá trị lẫn lộn (`-:-`, `– : –`, `—`); đã đăng nhập mà mở `/login?returnUrl=` thì bỏ qua returnUrl; thẻ Account hiện "Last sign-in" cũ hơn bảng Users (vòng 3) | S |
| UX-071 | Low | UX | Predictions, Detail, Dashboard | Live refresh ở trang ≥ 2 làm hàng trượt im lặng; id sai hiện "Invalid request parameter" thay vì "không tìm thấy"; khối "Form" của Dashboard toàn dấu gạch khi 10 prediction mới nhất còn Pending; Picks/hành động admin nằm ngoài khung nhìn ở 390px (vòng 3) | S |
| UX-076 | Low | UX | Dashboard, Reports, Models | "Win rate" không có định nghĩa trong UI: Half win tính như Win, Half loss tính như Loss (`(W+HW)/(W+HW+L+HL)`, chỉ ghi trong `API_DOCUMENTATION.md`); 26 Half loss kéo win rate xuống 39,3% (vòng 4) | S |
| UX-077 | Low | UX / Data | Agent API, Providers | Request bị từ chối (400, typo header `X-Provider`) vẫn tạo provider mới `0 model / 0 prediction`; không xoá/ẩn được; dropdown "AI model" hiện 2 dòng `SharedName 1` của 2 provider không phân biệt được (vòng 4) | S |
| UX-078 | Low | A11y | Router, Settings, Dialog | Đổi route không chuyển focus/không thông báo (focus ở link menu); form đổi mật khẩu thiếu trường username ẩn (Chrome cảnh báo); nút mở rộng thiếu `aria-controls`; footer dialog không dính đáy ở 320x400 (vòng 4) | S |
| UX-083 | Medium | Bug / A11y | Mọi dialog (Override, Recalculate, Add user, Reset password…) | Phím Esc không đóng dialog: handler `(cancel)="!closable() && $event.preventDefault()"` trả `false` khi `closable()` là true nên Angular tự gọi `preventDefault()`; `<dialog>` trần trong cùng trình duyệt đóng bằng Esc bình thường (vòng 4) | S |
| UX-079 | Low | UX | Filter bar, Agent API | Đổi ô chọn (Result, Market…) không có hiệu lực cho tới khi bấm Apply và không có dấu "chưa áp dụng"; chỉ Reports có export (không có ở Predictions/Matches/Models/API Logs); lỗi `415 Unsupported Media Type` không nói cần `application/json`; thông báo "size must be between 0 and 128" (vòng 4) | S |

## Đã kiểm tra, hoạt động tốt (không cần sửa)

- Login: sai mật khẩu hiện "Wrong username or password." rõ ràng; nút hiện/ẩn mật khẩu; focus ring 2px nhìn thấy khi Tab.
- Không có lỗi console, không có response 4xx/5xx, mọi call `/api/v1` dưới 400 ms khi tải dashboard, reports, matches, predictions, api-logs.
- Mobile 390px: không có cuộn ngang ở cấp trang trên cả 10 màn hình.
- Import: JSON sai thì có lỗi inline, gửi 2 lần thì báo "Already stored", có link "Open prediction". Settle tự chạy khi nhận kết quả
  FINISHED (AH HOME -0.25 thắng 2-0 ra WIN, OU OVER 2.75 ra LOSS: đúng với engine `settle-v1`).
- Dialog Override có mô tả "kết quả cũ được giữ trong history", bắt buộc chọn kết quả và lý do.
- Empty state của Predictions ("No predictions match these filters."), lỗi `from > to` hiện inline.
- Nginx: `/actuator`, `/swagger-ui.html`, `/v3/api-docs` chỉ trả SPA fallback (HTML), không lộ endpoint nào; có CSP, X-Frame-Options, nosniff.

---

## Match detail

### UX-001 — High — Missing feature — Không nhập được kết quả trận từ UI
- Repro: tạo prediction qua Import, mở `/matches/<id>`. Match ở trạng thái Scheduled. Chỉ có nút "Settle pending picks".
- Hiện tại: kết quả chỉ vào được qua `POST /external/matches/results` (cần `X-Api-Key`). `api.service.ts` chỉ có `settleMatch`,
  `recalculate`, `override`. Người dùng thường không thể đi hết flow import → xem → settle → report nếu agent không gửi kết quả.
  Trong test của tôi phải dùng `curl` với key để settle.
- Mong đợi: admin nhập tỉ số cuối, corner, tỉ số hiệp 1, trạng thái (FINISHED/CANCELLED/POSTPONED) trên trang match, bấm lưu là tự settle.
- Gợi ý: thêm endpoint JWT admin (ví dụ `POST /matches/{id}/result`) dùng lại logic của endpoint external, ghi vào result history
  với nguồn "ADMIN". Đổi contract nên cần cập nhật `API_DOCUMENTATION.md`, `models.ts`, `docs/samples`. Effort: M.

### UX-003 — Medium — UX — "Result history" là JSON thô
- Repro: `/matches/<id>` của trận đã FINISHED, cuộn tới "Result history". Ảnh: `backlog-screenshots/UX-003.png`.
- Hiện tại: khối JSON `{"previous": {...}, "new": {...}}` với toàn bộ trường null. Phải cuộn trong khung nhỏ.
- Mong đợi: bảng chỉ các trường thay đổi, ví dụ `Status: LIVE → FINISHED`, `Final: — → 2:1`, kèm nguồn và thời gian. Giữ nút xem JSON thô.
- Effort: S.

### UX-005 — Low — UX — Tiêu đề trang chung chung
- Header trang chi tiết luôn là "Match", "Prediction", "AI Model"; `<title>` là "Match · MatchMind". Tên đội/model chỉ nằm trong thẻ bên dưới.
- Mong đợi: `<h1>`/`<title>` = "UX Home – UX Away" hoặc tên model, để tab trình duyệt, lịch sử và screen reader dùng được.
- Effort: S.

## Predictions và Prediction detail

### UX-004 — Medium — UX — Giải thích settle là JSON thô
- Repro: `/predictions/<id>`, tab Picks, bấm mũi tên mở rộng một dòng.
- Hiện tại: dump JSON (`basisScore`, `settlementBasis: REMAINING_MATCH`, `calculationVersion`, mảng `legs`…). Người dùng phải tự suy ra
  vì sao AH -0.25 ra "Half loss".
- Mong đợi: một câu như "AH HOME -0.25, cơ sở REMAINING_MATCH từ 1-0, tỉ số cuối 2-1 nên phần còn lại 1-1 (margin 0): nửa stake push, nửa thua → Half loss",
  cộng nút "Xem JSON". Dữ liệu đã có sẵn trong `details`.
- Effort: M.

### UX-024 — Low — UX — Nhãn Stage trong tab Odds
- Repro: `/predictions/<id>` của dữ liệu E2E, tab Odds. Cột Stage hiện "Opening 1", "Pre match 1", "Live 1". Số 1 là thứ tự snapshot nhưng đọc như một phần tên.
- Gợi ý: tách thành cột "#" riêng hoặc ghi "Live (#1)". Effort: S.

### UX-025 — Low — UX — JSON thô trong tab Stats và Monte Carlo
- Tab Stats: mục "Other stats" in `{"dangerousAttacks": {"away": 22, "home": 41}}`. Tab Monte Carlo: "Probabilities" in `{"1X2": {"AWAY": 0.1, ...}}`.
- Mong đợi: bảng Home/Away cho stat bổ sung (giống các stat chính ngay phía trên), và bảng xác suất 1X2/OU theo %. Effort: S.

### UX-008 — Low — UX — Line AH hiển thị 2 kiểu
- Danh sách và dashboard: `AH HOME 0/-0.5`. Trang detail và bảng Picks: `AH HOME -0.25`. Cùng một pick.
- Gợi ý: chọn một quy ước chung (ví dụ `-0.25` kèm tooltip `0/-0.5`). Effort: S.

### UX-011 — Medium — UX / A11y — Cột quan trọng nằm ngoài khung nhìn
- Desktop 1440px: bảng Predictions phải cuộn ngang mới thấy Final, Result, Picks (ảnh `UX-011-desktop.png`). Result là câu trả lời chính của trang.
- Mobile 390px: chỉ thấy Predicted + Match; Pick/Result phải cuộn ngang (ảnh `UX-011-mobile.png`). 33 phần tử tương tác nhỏ hơn 32px trên Predictions, 57 trên Settings, 48 trên Reports.
- Gợi ý: ẩn mặc định các cột phụ (At capture, CS prob.), ghim cột Result, dưới 600px chuyển sang dạng thẻ (Match, Model, Pick, Result).
  Dùng chung bộ chọn cột đã có ở Reports. Effort: M.

### UX-010 — Medium — UX — Filter không nằm trên URL
- Repro: `/predictions`, nhập "UX Home", Enter. URL vẫn là `/predictions`. Đặt From/To rồi F5: ô From trống lại.
- Hiện tại: Reports lưu tab trên URL (`?tab=montecarlo`) nhưng không lưu filter. Dashboard mặc định 30 ngày nhưng Predictions/Reports mặc định không giới hạn ngày, dễ gây hiểu nhầm khi so số liệu.
- Mong đợi: filter, sort, page đồng bộ vào query string; nút Back và chia sẻ link hoạt động. Effort: M.

### UX-021 — Low — UX — Không ghi múi giờ
- Mọi mốc giờ (kick-off, predicted, result updated) hiển thị theo múi giờ trình duyệt, không có nhãn. Dashboard gửi `tz=Asia/Bangkok`.
- Gợi ý: hiện nhãn TZ (ví dụ "GMT+7") ở header hoặc tooltip UTC. Effort: S.

## Dashboard

### UX-022 — Low — UX — Biểu đồ rỗng không có thông báo
- Repro: khi chỉ có pick Pending (dashboard ban đầu). Biểu đồ "Win rate over time" và "Win rate by model" chỉ vẽ trục trống, không có chữ giải thích. Ảnh: `UX-022.png`.
- Mong đợi: "Chưa có pick nào được settle trong khoảng này". Ô "Active models 2 / 28" không giải thích "2 / 28" nghĩa gì (cần tooltip). Effort: S.

### UX-018 — Medium — Missing feature — Không có ROI, không có cảnh báo mẫu nhỏ
- Hiện tại: Win rate là chỉ số duy nhất (50,0% chỉ từ 2 pick đã settle). Price/odds đã lưu trong từng pick nhưng không có ROI hay lợi nhuận.
- Mong đợi (đúng ý đồ "AI performance tracking" trong `plan.md`): ROI/units với stake cố định 1 cho mỗi pick (WIN = price − 1, HALF_WIN = (price − 1)/2, HALF_LOSS = −0,5, LOSS = −1),
  badge "mẫu nhỏ (n < 30)" cạnh win rate, biểu đồ calibration (xác suất model đưa ra so với tỉ lệ trúng). Dùng BigDecimal phía server.
- Effort: L (thêm field vào reports, đổi contract).

## AI Models

### UX-007 — Low — Bug — Nhãn viết hoa sai
- Model detail, bảng "By market": hiện "Ah", "Corner ou", "Ou"; tiêu đề cột "market", "prediction type" viết thường. Ở nơi khác dùng "AH", "CORNER_OU". Ảnh: `UX-007.png`.
- Prompts: "Ai prediction · v9", "Ai settlement · v42" (đúng ra là "AI prediction"). Effort: S.

### UX-016 — Low — UX — Danh sách model thiếu công cụ
- 29 dòng, không search, sort, paging. Click vào hàng không mở detail (chỉ link ở tên), trong khi Predictions/Matches click cả hàng. Effort: S.

### UX-017 — Low — UX — Trùng model do version
- "E2E Model mwnfy0ni" xuất hiện 2 dòng (version `1` và `1.0`), `mwng14lf` tương tự. Win rate bị tách. Gợi ý: chuẩn hoá version (trim, bỏ ".0" dư) hoặc cảnh báo trên Import. Effort: S.

### UX-019 — Low — Missing feature — Không có màn Providers
- API có `GET /providers` (`lastCallbackAt`, số model, số prediction) nhưng UI chỉ dùng nó làm filter. Không biết agent nào đã ngừng gửi dữ liệu.
- Gợi ý: trang Providers: lần gọi cuối, số lỗi 24h, link sang API Logs đã lọc. Effort: M.

## Reports

### UX-006 — Medium — Bug / UX — Cột Wins/Losses chồng lấn
- Repro: `/reports`, tab "AI model performance". Một model có 3 pick settled hiện Wins 1, Half wins 0, Losses 2, Half losses 1. Tổng 4, không khớp Settled 3. Ảnh: `UX-006.png`.
- Tab "Market performance" cũng vậy: AH Losses 26 và Half losses 26. Nguyên nhân: Wins/Losses đã gồm cả nửa thắng/thua (khớp công thức win rate).
- Mong đợi: đổi nhãn thành "Wins (gồm ½)", "Losses (gồm ½)", hoặc hiện số loại trừ nhau. Effort: S.

### UX-009 — Medium — UX — Model comparison mặc định rỗng
- Repro: `/reports?tab=...`, tab "Model comparison". Mặc định "Matches with at least 2 models" nên hiện "No match has predictions from that many models" trong khi có 35 trận. Ảnh: `UX-009.png`.
- Gợi ý: mặc định 1, hoặc tự chọn giá trị lớn nhất có dữ liệu, hoặc hiển thị "Có N trận với 1 model; chọn 1". Effort: S.

## Import

### UX-015 — Low — UX — Import
- JSON cắt dở (`{ "eventId": "x",`) báo "No JSON object found. Paste the agent reply that contains the JSON." Sai nghĩa: JSON có nhưng sai cú pháp. Nên báo "JSON không hợp lệ" kèm vị trí.
- Sau khi lưu thành công, textarea và provider/model vẫn giữ nguyên (dễ gửi lại, ra "Already stored"). Nên có nút "Import khác" hoặc tự xoá.
- Chưa có xem trước (trận nào, mấy pick, mấy odds) trước khi gửi. Trường Provider/Model/Version không đánh dấu bắt buộc.
- Effort: S.

## API Logs và bảo mật

### UX-012 — Medium — UX — Cột Error bị cắt
- Repro: `/api-logs` ở 1440px. Dòng Rejected hiện "Invalid A…" và "EVENT_I…"; phải cuộn ngang. Ảnh: `UX-012.png`.
- Mong đợi: đặt Error ngay sau Outcome, cắt bằng ellipsis kèm tooltip, hoặc mở panel chi tiết khi click dòng (API đã có `GET /api-logs/{id}`; chưa xác nhận UI có dùng). Effort: S.

### UX-013 — Medium — Security — Client IP là gateway docker
- Mọi dòng log có Client IP `172.21.0.1`. Nếu prod cũng vậy (nginx không chuyển X-Forwarded-For hoặc Spring thiếu `forward-headers-strategy`),
  rate limit "20 mỗi IP" khi login gộp mọi người dùng thành một, và audit mất ý nghĩa. Cần xác nhận trên prod (trên Docker Desktop Windows có thể chỉ là NAT).
- Gợi ý: kiểm tra `X-Forwarded-For`/`X-Real-IP` trong `nginx/` và cấu hình Spring; test rate limit. Effort: S.

### UX-014 — Low — UX — Cột "Event id"
- Với `matches/results` và `settle`, cột chứa `externalMatchId`; dòng import qua UI của E2E để trống. Đổi nhãn thành "Event / match id". Effort: S.

## Settings và dữ liệu thử

### UX-002 — Medium — Security / UX — Dữ liệu E2E tồn đọng, không archive được
- Hiện tại: 28 model, 29 provider (kể cả `chatgpt`), 35 trận, và khoảng 20 tài khoản `viewer-mwn…` trạng thái Active trong Settings. Dropdown "AI model"
  ở mọi filter có 28 dòng "E2E Model …". Nếu stack này gần với prod thì đây là tài khoản thừa quyền xem.
- Không màn nào cho xoá/ẩn model, provider, match hay user (chỉ Disable user).
- Gợi ý: (1) E2E tự dọn tài khoản/dữ liệu hoặc chạy trên DB riêng; (2) thêm cờ `archived` cho model/provider (ẩn khỏi filter và report mặc định);
  (3) nút "Disable all" hoặc lọc user theo trạng thái. Effort: M.

### UX-020 — Low — Missing feature — Settings thiếu hướng dẫn kết nối
- Thẻ "Your account" gần như trống (xem ảnh Settings trong phiên); không có URL endpoint, danh sách header cần gửi, hay cách xoay `EXTERNAL_API_KEY`.
  Bảng Users không phân trang/tìm kiếm khi có nhiều tài khoản. Effort: S.

## Khác

### UX-023 — Low — UX — Không có trang 404
- Route `**` redirect về `''` rồi về dashboard mà không báo gì; gõ sai URL không biết vì sao. Effort: S.

---

# Vòng 2 (UX Reviewer, Agent 1) — góc nhìn: dữ liệu biên, bảo mật phiên/role, workflow sửa kết quả, live update

Phạm vi vòng này: import biên (mảng, 2 JSON, unicode, 3 MB, trùng), sửa kết quả sau settle, recalculate có kết quả đổi, viewer role,
tạo/đổi role/disable/reset user, đăng xuất và thu hồi token, khoá đăng nhập, SSE burst, xung đột sửa Prompt, hết phiên khi đang sửa,
CORS, contrast, landmark/label, CSV. Dữ liệu thử đã tạo: provider/model `ux-review`, `ux-review-b`, các trận `uxr2-*`, `Cross Home`,
user `ux3-viewer`, `ux4-admin`, `ux5-viewer` (cả ba đã Disable). Không xoá dữ liệu nào.
Ghi chú: các dòng UX-026..UX-042 ở bảng trên được thêm sau vòng 1 nên chưa có section chi tiết; mô tả trong bảng là repro rút gọn.

## Import và Agent API (dữ liệu biên)

### UX-045 — High — Bug / Data integrity — Payload sau ghi đè thông tin trận
- Repro: `POST /predictions/import?provider=ux-review&model=ux-review` với `match.externalMatchId = "cross-1"`, đội `Cross Home – Cross Away` (201).
  Gửi tiếp payload khác `eventId`, cùng `externalMatchId = "cross-1"` nhưng `homeTeam = "Totally Different Team"` (201).
- Thực tế: tìm "Cross" ra `Totally Different Team v Cross Away | ext=cross-1 | preds=2`. Tên đội của trận đổi, prediction đầu tiên giờ nằm dưới
  trận "khác". Không có lỗi, không có cảnh báo, không có dòng audit về việc đổi. Một typo hay một agent ảo giác `externalMatchId` trùng
  trận cũ là đủ làm sai sổ (nhất là khi trận đã settle).
- Mong đợi: nếu match đã tồn tại thì so khớp `league/homeTeam/awayTeam/startTime` với bản đã lưu; lệch thì trả `409 MATCH_MISMATCH`
  (kèm khác biệt) hoặc chỉ cập nhật `startTime` trong ngưỡng nhỏ, kèm ghi vào result/match history. Đổi contract nhẹ (thêm mã lỗi), cần cập nhật `API_DOCUMENTATION.md`.
- Effort: S.

### UX-046 — Medium — Bug / Data integrity — Trùng prediction khi đổi eventId
- Repro: import một payload PRE_MATCH (eventId `uxr2-a`), rồi import đúng nội dung đó với `eventId = uxr2-a2`. Cả hai trả 201. Ảnh: `backlog-screenshots/UX-046-duplicate-prediction-match.png`
  (trận `uxr2-m-001` có 2 prediction giống hệt, cột Predictions = 2).
- Thực tế: idempotency chỉ theo `(provider, eventId)` + hash. LLM agent hay tự bịa `eventId`, nên retry ra prediction mới, và cả hai được settle (win rate, picks bị nhân đôi).
  Luật hiện tại của AGENTS.override.md giữ nguyên hành vi trên (đúng), vấn đề là không có tín hiệu nào cho người dùng.
- Mong đợi: ít nhất cảnh báo ở Import/Prediction detail ("đã có prediction cùng model/trận/loại/pick, giống 100%"); tuỳ chọn: loại trừ bản trùng khỏi report
  (cờ `duplicateOf`) hoặc chỉ tính prediction mới nhất mỗi `(model, match, predictionType, matchMinute)`.
- Effort: M (đổi cách tính report thì L).

### UX-047 — Medium — Missing feature — Không có định danh trận xuyên provider
- Repro: provider A gửi trận `cross-1`, provider B gửi cùng trận thật (cùng đội, cùng giờ, giải) với `externalMatchId = other-id-for-same-fixture`.
- Thực tế: hai dòng trong Matches, mỗi dòng một model. Tab "Model comparison" chỉ ghép các model trong cùng một match nên model của hai agent
  khác nhau không bao giờ so sánh được. Đây là câu hỏi chính của sản phẩm ("model nào dự đoán tốt hơn").
- Mong đợi: khoá tự nhiên mềm (`league + homeTeam + awayTeam + startTime ± 6h`, chuẩn hoá chữ thường/dấu) để gộp vào một match, hoặc
  công cụ "Merge matches" cho admin (kết quả gộp, history giữ nguồn). Đổi schema/contract (V<next>), cần plan riêng.
- Effort: L.

### UX-055 — Low — UX — Import: nhiều JSON, mảng, lỗi thô
- Dán một reply có 2 khối JSON, hoặc một mảng `[ {...}, {...} ]`: nút Send bị khoá và hiện "The JSON is not valid JSON: Unexpected non-whitespace character after JSON at position 459 (line 1 column 460)".
  Bộ tách lấy từ `{` đầu tới `}` cuối nên mảng bị cắt dấu `[`. Không có cách import hàng loạt (power user phải gửi từng cái).
- Lỗi API hiện kèm mã thô và thiếu dấu câu: "VALIDATION_ERROR: Payload validation failed correctScore must not be null", "UNKNOWN: Request failed (413)" (3 MB). `correctScore` bắt buộc
  với mọi prediction, mà form không nói trước.
- Mong đợi: nhận mảng hoặc nhiều khối và hiện bảng kết quả từng dòng (stored/duplicate/error); lỗi dạng "Thiếu `correctScore`" kèm dòng; 413 nói rõ giới hạn dung lượng.
- Unicode/emoji/CJK ổn: `Ünï Home – Ωmega Away 球队 😀` lưu và hiển thị đúng; tìm "uni home" không dấu ra kết quả.
- Effort: S (hàng loạt: M).

### UX-054 — Medium — Bug / Cần xác minh — CORS external từ origin lạ
- Repro (Git Bash): `curl -i -X OPTIONS http://localhost:8088/api/v1/external/predictions -H "Origin: https://claude.ai" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: x-api-key,content-type"` trả `403`, không có `Access-Control-Allow-Origin`.
  Cùng lệnh với `Origin: http://localhost:4200` hoặc `http://localhost:8088` trả 200.
- `SecurityConfig` ghi "any page may call the external callbacks" (`setAllowedOrigins("*")` cho `/api/v1/external/**`), nhưng container API tạo 18:02 có thể chạy bản build cũ hơn working tree.
  Nếu bản chạy thật đúng như vậy thì artifact "MatchMind" (gửi từ browser của người dùng) sẽ hỏng ở prod.
- Hành động: build lại image rồi thử lại; nếu vẫn 403 thì chỉnh cấu hình CORS (nginx có thể chặn trước). Thêm một IT cho preflight. Effort: S.

### UX-061 — Medium — Missing feature — Không chặn được một agent
- plan.md §12 yêu cầu Providers: list/add/edit/enable-disable/rotate/revoke/view activity. Hiện provider tự sinh khi gọi lần đầu, chỉ có một `EXTERNAL_API_KEY` chung (UX-027) và không có màn Providers (UX-019).
  Agent bị lỗi hoặc bị rò key thì không tắt riêng được, chỉ còn cách đổi key cho mọi agent. Gợi ý: cờ `disabled` theo provider (API trả `403 PROVIDER_DISABLED`), nút ở màn Providers, hiện lần gọi cuối.
- Effort: M (đổi contract nhẹ).

## Kết quả trận và settle

### UX-051 — High — UX / Data integrity — Sửa kết quả sau settle: trang chi tiết vẫn hiện Win
- Repro: trận `uxr2-m-001`, pick `OU OVER 2.5`. Gửi result `FINISHED 2-1` (settle: WIN). Gửi tiếp `FINISHED 1-1` (response `alreadySettled: 2, needsReview: 2`).
  Mở `/matches/<id>`: "Full time 1 : 1" nhưng bảng "Models on this match" vẫn "Win · 2 / 0 · 100.0%". Ảnh: `UX-051-result-corrected-stale-win.png`.
- Dashboard có thẻ "Needs review (2)" với cột Stored/Now (Win → Loss), nhưng chỉ ở Dashboard (ảnh `UX-051-dashboard-needs-review.png`). Match detail, Prediction detail, Reports, thanh menu không có tín hiệu;
  dialog Recalculate chỉ ghi "current: Win", không cho biết kết quả mới sẽ là gì. Nút "Settle pending picks" ở Match detail không xử lý trường hợp này.
  Report và win rate vẫn đếm bản cũ (sai) cho đến khi admin vào từng prediction. Phải mở từng prediction một: N pick lệch = N lần Recalculate + N lý do.
- Mong đợi: (1) banner trên Match detail/Prediction detail "Kết quả trận đã đổi, pick này sẽ ra Loss" kèm nút Recalculate; (2) badge số trên menu Dashboard; (3) nút "Recalculate N picks" theo trận
  (một lý do chung; vẫn append-only); (4) report ghi chú "N pick đang chờ xem lại". Tôn trọng luật append-only, không auto-resettle.
- Mặt tích cực đã kiểm: sau Recalculate toast "Recalculated · OU OVER: Loss", dòng cũ giữ dạng "superseded" với lý do, pick mới ghi "Admin recalculation". Thẻ Needs review giảm 2 → 1.
- Effort: M.

## Settings và phiên đăng nhập

### UX-043 — Medium — Security — Khoá đăng nhập theo username, không có mở khoá
- Repro: 5 lần `POST /auth/login` với `ux3-viewer` + mật khẩu sai (401). Lần thứ 6, kể cả mật khẩu đúng: `429 Too many login attempts. Try again in 15 minute(s)` (`Retry-After: 899`). Ảnh: `UX-043-login-locked.png`.
- `LoginRateLimiter` đếm lỗi theo username và chặn cả khi mật khẩu đúng. Ai biết tên admin (thường là `admin`) có thể khoá admin bất kỳ lúc nào chỉ bằng 5 request; admin duy nhất không có nút mở khoá, bộ đếm nằm trong bộ nhớ nên chỉ khởi động lại mới xoá.
  Message hiện hai lần (inline + toast).
- Mong đợi: khoá theo cặp `(username, IP)` hoặc làm chậm dần (backoff) thay vì khoá cứng; admin đã đăng nhập mở khoá được user; không khoá hẳn tài khoản admin theo username từ IP lạ.
- Effort: S.

### UX-044 — Medium — UX / Security — Đổi role không có xác nhận
- Repro: `/settings`, bảng Users, đổi `<select aria-label="Role of ux3-viewer">` từ Viewer sang Admin. Request `PATCH /users/<id>` trả 200 ngay, không có dialog, không toast, không ghi nhận ở đâu trong UI.
  Đổi lại cũng vậy. Tác dụng tức thì (token cũ của người đó có quyền admin ngay, xác minh: `GET /users` bằng token viewer cũ trả 200 sau khi promote, 403 sau khi demote).
- Mong đợi: xác nhận bằng dialog ("Cấp quyền Admin cho X?"), toast sau khi lưu, hoàn tác (undo) vài giây, dòng audit "ai đổi role ai". Lưu ý: UX-042 đã nêu Disable cũng không xác nhận.
- Effort: S.

### UX-048 — Medium — UX / Data loss — Hết phiên khi đang sửa
- Repro: đăng nhập admin, `/prompts`, chọn template, Edit, gõ nội dung. Phiên bị thu hồi phía server (ví dụ admin khác Disable, hoặc hết hạn, giả lập bằng `POST /auth/logout`). Bấm Save.
- Thực tế: API trả 401, app điều hướng sang `/login` và bị guard chặn bằng hộp thoại native "Discard your unsaved changes?". Bấm Cancel: ở lại trang, `sessionStorage` đã rỗng, header chỉ còn chữ "Viewer"
  (không tên), form vẫn hiện nút Save, không có thông báo "hết phiên". Ảnh: `UX-048-session-expired-editing.png`. Bấm OK thì mất toàn bộ nội dung sửa (prompt dài, có thể hàng trăm dòng).
- Mong đợi: khi 401, giữ nguyên trang và hiện banner "Phiên đã hết, đăng nhập lại để lưu" với nút mở đăng nhập trong dialog (hoặc tab mới) rồi lưu tiếp; ít nhất lưu bản nháp vào `sessionStorage` và nạp lại sau khi đăng nhập
  (xem thêm UX-035 `returnUrl`). Nên cảnh báo hết hạn trước ~5 phút (JWT 8 giờ, không có refresh).
- Effort: S (bản nháp) / M (đăng nhập lại tại chỗ).

### UX-059 — Low — UX / Security — Tạo user và reset mật khẩu
- Dialog "Add user": ô mật khẩu không có nút hiện/ẩn hay sinh ngẫu nhiên, không có tuỳ chọn "bắt đổi mật khẩu ở lần đăng nhập đầu". Reset mật khẩu cũng để admin tự gõ (chấp nhận `1234567890`, xem UX-031).
  Mật khẩu tạm đi qua kênh chat/email của admin. Mặt tích cực: disable user và reset mật khẩu thu hồi token ngay (`/auth/me` trả 401).
- Gợi ý: nút "Generate" (16 ký tự) hiện một lần kèm Copy, cờ `mustChangePassword`. Effort: S (cờ: M, đổi schema).

## Live update và hiệu năng

### UX-049 — Medium — Perf — SSE không gộp sự kiện
- Repro: mở `/dashboard`, bắn 12 `POST /predictions/import` song song (mỗi cái 201, ~45 ms). Đếm request GET sau đó: `/dashboard` 12 lần và `/predictions` 12 lần; toast riêng cho từng prediction (tối đa 4 hiện cùng lúc). Ảnh: `UX-049-toast-burst.png`.
- `LiveService.announce` gọi `refresh.next()` ở từng sự kiện. Với agent chạy theo lô (hàng trăm prediction trong vài giây) và nhiều người xem, mỗi người gọi `/dashboard` (aggregate nặng nhất) hàng trăm lần.
- Mong đợi: debounce/throttle `refresh` (1–2 s, trailing), gộp toast thành "12 new predictions", không refetch khi tab đang sửa form.
- Mặt tích cực: dùng `fetch` có header Authorization (không đưa JWT lên URL), tự nối lại, dừng khi tab ẩn, báo offline/online.
- Effort: S.

## Match detail

### UX-050 — Medium — Missing feature — Không xem được toàn bộ prediction của một trận
- Repro: `/matches/<id>` của trận có 2 prediction cùng model (`uxr2-m-001`). Bảng "Models on this match": Predictions = 2, nhưng chỉ có một link tới prediction mới nhất (ô Latest). Không có danh sách/timeline
  (Opening, Pre-match, Live phút 20, 60…) và không có link "Xem tất cả 2 prediction". Ảnh: `UX-050-match-detail-two-predictions.png`.
- plan.md §8 yêu cầu "Prediction history" và "AI Model comparisons" trên Match detail. Với tính năng live (nhiều prediction/trận) đây là luồng chính để thấy model đổi ý thế nào theo thời gian.
- Gợi ý: bảng thứ hai "Prediction history" (giờ, loại, phút, tỉ số hiện tại, top pick, kết quả) hoặc link sang `/predictions?matchId=...` (filter theo trận cần API có `matchId`, kiểm tra trước). Effort: M.

## Bảo mật, audit, quyền riêng tư

### UX-052 — Low — Security / Audit — Log không ghi người thực hiện
- Repro: `/api-logs`, mở một dòng `POST /api/v1/predictions/import`. Trường "Provider / key" là `0fb8f294-…  / —` (UUID, không phải tên); không có admin nào được ghi. Import/settle/override qua UI
  không thể truy ngược người làm. Processing result là JSON thô với UUID, không link sang prediction/match.
- Gợi ý: hiện tên provider (link), thêm cột/ trường `actor` (username từ JWT) ở audit; giữ không ghi body hay secret. Effort: S (cần thêm cột, đổi contract nhẹ).

### UX-053 — Low — Security / Privacy — Font từ Google
- Mỗi lần tải trang, trình duyệt gọi `https://fonts.gstatic.com` (đo bằng `performance.getEntriesByType('resource')`). CSP phải cho `fonts.googleapis.com` và `style-src 'unsafe-inline'`.
  App tự nhận là "Private workspace" nhưng lộ IP/giờ truy cập cho Google; nếu máy chạy trong mạng chặn ra ngoài thì font fallback, bố cục có thể lệch.
- Gợi ý: self-host woff2 trong `matchmind-web/public` (cache dài, hash tên file), bỏ hai nguồn Google khỏi CSP. Effort: S.

## Prompts

### UX-056 — Low — UX — Hộp native confirm
- Repro: Prompts, Edit, gõ chữ, bấm Cancel hoặc bấm tên template (kể cả template đang sửa) hoặc bấm link menu: hộp native `confirm("Discard your unsaved changes?")`. Kit của app đã có dialog xác nhận riêng (UX khác, không dịch được,
  Playwright/E2E khó bắt, trên mobile hiện kiểu khác). Hộp native cũng làm UX-048 tệ hơn. Gợi ý: dùng `confirm` của `shared/kit.ts` với nút "Keep editing / Discard". Effort: S.

### UX-060 — Low — Missing feature — Prompt không có lịch sử
- `PUT /prompts/{id}` tăng `version` nhưng không lưu bản cũ: sửa nhầm prompt mà agent đang dùng (Copy → dán vào agent) thì không khôi phục được. Xung đột `expectedVersion` được xử lý rất tốt:
  "Someone saved a newer version while you were editing. Your text is still here: copy it, then reload…" kèm nút "Reload latest" (đã kiểm chứng, giữ nguyên văn bản).
- Viewer: nút Copy vẫn hiện, copy bản gốc còn `{{EXTERNAL_API_KEY}}` và `{{MATCHMIND_SHEET_URL}}` và toast "Prompt copied to the clipboard" mà không giải thích placeholder còn đó (admin mới được điền key, đúng thiết kế).
- Gợi ý: bảng `prompt_template_versions` (append-only, V<next>), danh sách "History" với diff và nút Restore; viewer thấy ghi chú ngắn "Placeholder chưa điền: nhờ admin". Effort: M.

## Dashboard và a11y

### UX-057 — Low — UX — Dashboard bỏ năm
- Repro: seed có prediction `predictedAt = 2036-11-20` (UX-028). `/predictions` hiện "Nov 20, 2036, 5:00 PM", nhưng "Latest predictions" trên Dashboard hiện "Nov 20, 05:00 PM" (không năm), như hôm nay. Làm UX-028 khó bị phát hiện.
  Đề xuất: thêm năm khi khác năm hiện tại, hoặc luôn hiện năm; đánh dấu "(tương lai)" khi `predictedAt` > now. Effort: S.

### UX-058 — Low — A11y — Viền ô nhập
- Đo trên `/reports`: viền input so với nền 1,28:1 (WCAG 1.4.11 Non-text Contrast yêu cầu 3:1 cho ranh giới của control); màu chữ tốt (muted 6,38:1; tag Pending 6,36:1, Half loss 5,55:1; tag luôn có chữ nên không chỉ dựa vào màu).
  Effort: S (đổi token `--border-input`).

## Đã kiểm tra ở vòng 2, hoạt động tốt

- Phiên: Sign out thu hồi token ngay (token cũ trả 401); Disable user và Reset password thu hồi token ngay; role đọc từ DB mỗi request (promote/demote có hiệu lực tức thì).
- Viewer: menu không có Import; nút Edit/New template/Settle/Recalculate/Override ẩn; `GET /prompts/{id}/for-agent` chỉ admin (viewer không lấy được key); Settings chỉ còn "Change password".
- API đọc: `size=100000` bị chặn trần, `size=-5`/`page=-1` ra mặc định, sort không hợp lệ bị bỏ qua, `search=%` hay `' OR 1=1--` trả rỗng (đã escape LIKE), UUID/ngày sai trả 400 `INVALID_PARAMETER`/`VALIDATION_ERROR` không lộ stack.
- Prompts: xung đột sửa đồng thời (409) giữ nguyên văn bản; hộp thoại có `beforeunload` khi đóng tab lúc đang sửa.
- Reports khớp plan.md §10: header sticky, ẩn/hiện cột, có handle đổi độ rộng cột (chưa thử kéo), dòng mở rộng "By market"/"By league", CSV có BOM UTF-8 mở được trong Excel, tab lưu trên URL. Prediction detail có tab "Raw payload"; API Logs có dialog chi tiết.
- A11y cơ bản: `lang="en"`, một `<h1>`, đủ landmark (aside/nav/header/main), mọi input có nhãn, không nút nào thiếu tên, `<dialog>` modal có `aria-labelledby`. Tag trạng thái luôn có chữ.
- Unicode/emoji/CJK trong tên đội lưu, hiển thị, tìm kiếm (không dấu) và xuất CSV đúng.

## Việc chưa kiểm tra (để vòng sau)
- Đổi mật khẩu của chính mình (sai mật khẩu hiện tại, mật khẩu mới trùng cũ, "signs you out everywhere" có thật không).
- Settle/Override khi hai admin cùng thao tác một pick; Override sau Recalculate; Override trên CANCELLED/POSTPONED.
- Dark mode (chưa có `prefers-color-scheme`), RTL, zoom 200% và 400% (reflow), `prefers-reduced-motion`.
- Kiểm thử screen reader thật (NVDA/VoiceOver) cho bảng có dòng mở rộng và tablist.
- Hiệu năng khi có hàng chục nghìn prediction (hiện chỉ có ~140).

---

# Vòng 3 (UX Reviewer, Agent 1) — góc nhìn: API biên/thời gian, phiên và thu hồi, đồng thời, authz toàn bộ route, hiệu năng dữ liệu lớn, reflow/bàn phím

Phạm vi: đổi mật khẩu của chính mình, kết quả trận biên (CANCELLED/POSTPONED, đổi trạng thái sau settle, `resultAt` tương lai, trận chưa đá),
override/recalculate đồng thời, quét authz mọi route (anon + viewer), SSE khi bị thu hồi, 300 prediction thêm vào để đo hiệu năng, reflow 320px, aria-sort, tiêu đề/caching,
prompt template. Dữ liệu thử đã tạo: provider `ux-review-c`, `ux-review-perf` (300 prediction `perf-*`, 60 trận `uxr3-perf-m*`), `ux-review-sse`, các trận `uxr3-*`, user `ux7-viewer` (đã Disable).
Không đăng xuất admin (token admin dùng chung với agent khác) và không xoá dữ liệu nào.

## Agent API: kết quả trận

### UX-063 — High — Bug / Data integrity — `resultAt` tương lai khoá vĩnh viễn kết quả của trận
- Repro (curl, header `X-Api-Key`, `X-Provider: ux-review-c`): import trận `uxr3-m1` (start 2026-11-18). `POST /external/matches/results` `{status:FINISHED, finalScore 3-0, resultAt:"2036-11-19T13:00:00Z"}` trả 200 và settle luôn.
  Gửi tiếp kết quả đúng `0-0` với `resultAt` hiện tại: `409 STALE_RESULT "A newer result (2036-11-19T13:00:00Z) is already stored for this match"`.
- Hậu quả: một agent ảo giác `resultAt` (hoặc nhầm năm) làm trận không sửa được nữa qua API; UI không có cách nhập kết quả (UX-001) nên admin chỉ còn Override từng pick, còn tỉ số trận, history và mọi report theo trận vẫn sai.
  Thêm: `FINISHED 1-0` cho trận `uxr3-tz2` có `startTime` 2026-11-21 (ngày mai) vẫn được nhận và settle ngay, chưa có cảnh báo nào.
- Mong đợi: từ chối `resultAt` > now + vài phút (`400 INVALID_RESULT_TIME`); `FINISHED` khi `startTime` còn ở tương lai thì `409 MATCH_NOT_STARTED` (hoặc cần cờ rõ ràng); endpoint admin sửa kết quả (UX-001) được phép vượt `STALE_RESULT` kèm lý do, ghi history.
- Đổi contract nhẹ (thêm mã lỗi), cập nhật `API_DOCUMENTATION.md`. Effort: S.
- Đã kiểm, đúng: `finalScore.home = -1` hay 999 trả 400 `must be >= 0 / <= 99`; `FINISHED` thiếu `finalScore` trả 400; `CANCELLED` settle VOID đúng; `POSTPONED` không settle; `CANCELLED` rồi `FINISHED` cho `needsReview: 2` (đúng thiết kế append-only).

### UX-067 — Medium — Bug / Config — Prompt cứng URL production, thiếu prompt cho kết quả trận
- Repro: Prompt Notes > AI Football Prediction Prompt (v9) và AI Settlement Prompt (v42): đoạn "POST https://match.kira.id.vn/api/v1/external/predictions" (và `/predictions/settle`) là chuỗi cố định (quét bằng `GET /prompts/{id}`; chỉ có placeholder `{{EXTERNAL_API_KEY}}`).
- Thực tế: copy prompt từ bản local/staging, điền key của stack đó (Copy thay `{{EXTERNAL_API_KEY}}`), agent vẫn gửi tới host production, hoặc key local bị gửi tới production. Người mới cũng không biết URL này phải đổi.
  Cả hai template đều không nhắc `POST /external/matches/results`, nên agent không có chỉ dẫn nào để gửi kết quả trận, cùng gốc với UX-001 (flow import → settle bị cắt).
- Mong đợi: placeholder `{{MATCHMIND_API_URL}}` do UI điền từ origin của API; thêm template thứ ba "Match result" (hoặc thêm vào Settlement) mô tả `matches/results` kèm `resultAt` và quy tắc UX-063.
- Effort: S.
- Ghi chú (tích cực): prompt dặn agent bỏ `predictedAt` và `match.startTime` khi không biết, giảm rủi ro UX-028; nhưng bỏ `startTime` làm UX-047 (định danh trận xuyên provider) khó hơn nữa.

### Bổ sung cho UX-001 (vòng 3)
- Dán JSON kết quả trận vào màn Import (đã thử): "UNKNOWN_FIELD: Unknown field 'externalMatchId' externalMatchId unknown field". Import chỉ hiểu prediction, nên quy trình thủ công (agent trả kết quả trong chat) cũng không có đường vào. Cộng với UX-067: không có chỗ nào (UI, prompt) cho phép đưa kết quả vào. Giữ mức High.

### Bổ sung cho UX-054 (vòng 3): nghi vấn bản build cũ
- `GET /api/v1/external/ping` trên stack đang chạy trả `401 INVALID_API_KEY "Missing API key"`, trong khi `API_DOCUMENTATION.md` và `SecurityConfig` (`requestMatchers(GET, ExternalPingController.PATH).permitAll()`) nói đây là endpoint công khai.
  Container `matchmind-api-1` tạo lúc 18:02 (+07), `SecurityConfig.java` sửa lúc 21:48: image cũ hơn mã nguồn. Cùng nguyên nhân với preflight CORS 403, nên cần build lại rồi kiểm cả hai trước khi coi là lỗi.

## Settle, override

### UX-065 — Medium — Data integrity — Override pick của trận chưa đá
- Repro: prediction `e3bfe7b8-…` (`uxr3-tz4`, `startTime` 1970-01-01, trận `Scheduled`, chưa có kết quả). `POST /settlements/picks/{id}/override` `{result:WIN, reason:"…"}` trả 200 `OVERRIDDEN`. Ảnh: `backlog-screenshots/UX-065-override-on-scheduled-match.png`
  (header `Scheduled`, Final `-:-`, nhưng pick hiện **Win**, cột "Settled by: Admin override").
- Thực tế: pick vào win rate và report khi chưa có trận nào. Response `reason: null` (lý do chỉ có trong history); override lần hai cùng kết quả trả `UNCHANGED` và bỏ lý do mới (giống UX-034).
  Recalculate sau đó đưa pick về PENDING, nên override mất tác dụng mà không cảnh báo trước.
- Mong đợi: chặn override khi trận chưa FINISHED/CANCELLED, hoặc dialog hỏi "Trận chưa kết thúc, kết quả sẽ mất khi recalculate"; hiện lý do trong response.
- Đã kiểm, đúng: override `PENDING` bị 400, lý do trắng bị 400; **5 recalculate song song cùng một pick** cho 1 dòng SUPERSEDED + 4 UNCHANGED, lịch sử có đúng 1 dòng current (không race).
- Effort: S.

## Phiên, thu hồi, bảo mật

### UX-062 — Medium — Security — Đổi mật khẩu không bị giới hạn thử
- Repro: đăng nhập `ux7-viewer`, gọi 12 lần `POST /auth/change-password` với `currentPassword` sai: cả 12 đều `400 BAD_CURRENT_PASSWORD`, tổng 2,6 s (~4,5 lần/giây), không 429, không khoá, token vẫn sống.
  `LoginRateLimiter` chỉ bảo vệ `/auth/login`. Ai lấy được JWT (sessionStorage, 8 giờ) dò được mật khẩu thật rồi đăng nhập lại sau khi token bị thu hồi.
- Thêm: `newPassword == currentPassword` được nhận (204) và vẫn đăng xuất mọi phiên, không có lỗi "mật khẩu mới phải khác".
  Form ở Settings có autocomplete đúng (`current-password`, `new-password`) và ghi "signs you out everywhere" (đúng, đã kiểm: token cũ 401 ngay).
- Mong đợi: dùng chung bộ đếm với login theo user (hoặc 5 lần sai trong 15 phút rồi 429), từ chối mật khẩu mới trùng cũ.
- Effort: S.

### UX-064 — Medium — Security — SSE không đóng khi thu hồi token
- Repro: mở `GET /events/predictions` bằng token `ux7-viewer` (stream đọc bằng `fetch`), admin `PATCH /users/{id} {status:DISABLED}` (200), rồi import một prediction. Stream của user đã Disable **vẫn nhận** `event:prediction` (id prediction, id trận, đội, model).
  Mọi endpoint REST của user đó đã trả 401 từ lúc Disable (đúng), riêng luồng SSE giữ nguyên cho tới khi client tự ngắt.
- Tương tự với logout, reset mật khẩu, đổi mật khẩu (cùng cơ chế `tokenVersion`). Rủi ro thấp (dữ liệu chỉ là metadata) nhưng phá vỡ lời hứa "thu hồi ngay" của tài liệu API.
- Mong đợi: khi nhả heartbeat hoặc phát sự kiện thì kiểm lại `tokenVersion`/trạng thái user và đóng emitter; hoặc đóng mọi emitter của user ngay lúc thu hồi; giới hạn tuổi thọ luồng bằng `exp` của JWT.
- Effort: S.

### UX-068 — Low — Security / API — Lỗi lộ chi tiết nội bộ, dạng lỗi không nhất quán
- `GET /dashboard?from=2026-13-45` trả `fieldErrors.from = "Failed to convert value of type 'java.lang.String' to required type 'java.time.Instant'; Failed to convert from type [java.lang.String] to type [java.time.Instant] for value [2026-13-45]"`.
  Cùng lỗi trên `/matches?from=garbage` trả `INVALID_PARAMETER` gọn. Message nên thống nhất ("from phải là ngày ISO").
- 401/403 do Spring Security trả `{"status","code","message"}` không có `timestamp`, `path`, `traceId`, `fieldErrors`, `Content-Type` ISO-8859-1; phần còn lại có đủ. Client dùng `traceId` để báo lỗi sẽ thiếu với 401/403.
- Effort: S.

### UX-069 — Low — Security / Ops — Header lặp, không nén
- `curl -i /api/v1/...`: `Content-Security-Policy` xuất hiện 2 lần (API: `default-src 'self'; frame-ancestors 'none'; object-src 'none'` và nginx: bản đầy đủ), `X-Frame-Options: DENY` và `X-Content-Type-Options: nosniff` đều lặp. Trình duyệt áp dụng giao của hai CSP nên không hỏng, nhưng dễ lệch khi sửa một chỗ.
- Không có `Content-Encoding` cho `main-*.js` (295 044 byte) và `styles-*.css` (32 749 byte) dù gửi `Accept-Encoding: gzip, br`; `nginx.conf` không có `gzip on`. Nén được khoảng 70% (S).
- Không thấy `Strict-Transport-Security` (đúng với http local; cần có ở prod HTTPS). Cache: `index.html` `no-cache`, file băm tên `immutable` 1 năm (tốt).
- Effort: S.

## Import

### UX-066 — Low — UX — Nút Send khoá không giải thích
- Repro: `/import`, Provider đã nhớ (localStorage `matchmind.import-provider`), dán JSON không có `model`, để ô Model trống (placeholder `gpt-5.1` xám, trông như đã điền): nút "Send prediction" mờ, không có thông báo nào. Ảnh: `backlog-screenshots/UX-066-import-disabled-no-reason.png`.
  Người lần đầu dùng không biết thiếu gì. Gợi ý: không disable mà bấm vào thì báo "Nhập tên model (hoặc thêm vào JSON)", đánh dấu `*` các ô bắt buộc, và nhận `model` từ JSON làm giá trị mặc định.
- Dán JSON kết quả trận (xem bổ sung UX-001) ra lỗi lặp chữ "Unknown field 'externalMatchId' externalMatchId unknown field"; nên nhận diện "đây là kết quả trận, không phải prediction".
- Effort: S.

## Khác

### UX-070 — Low — UX / A11y — Chi tiết nhỏ nhưng lặp
- Predictions: hai tiêu đề cột đều là "Predicted" (thời điểm dự đoán và tỉ số dự đoán); screen reader và CSV dễ nhầm. Đổi cột tỉ số thành "Predicted score".
- Giá trị thiếu hiện 3 kiểu: ô tối `-:-` (Final, At capture), `– : –` (Final corners, trang detail), `—` (Min, Settled by). AGENTS.override.md chỉ quy định `—`; nên thống nhất.
- Đã đăng nhập mà mở `/login?returnUrl=%2Fmatches` thì chuyển về `/dashboard`, bỏ returnUrl (liên quan UX-035).
- Settings > Your account: "Last sign-in Nov 20, 1:20 AM", trong khi bảng Users cùng lúc ghi 1:44 AM cho `admin` (thẻ lấy từ lúc đăng nhập đầu của phiên).
- Effort: S.

### UX-071 — Low — UX — Live refresh, lỗi không tìm thấy, mobile
- Live refresh (UX-049): đứng ở "Page 2 of 15", gửi 1 prediction từ ngoài: tổng đổi 368 → 369, trang giữ nguyên nhưng hàng đầu của trang 2 đổi mà không có dấu hiệu; có thể bấm nhầm vào hàng vừa trượt. Gợi ý: banner "1 prediction mới, bấm để tải lại" khi đang ở trang > 1 hoặc đang có filter.
- `/predictions/not-a-uuid` hiện "Couldn't load this data. Invalid request parameter" (còn `/matches/<uuid lạ>` hiện "Match not found"). Nên cùng "Prediction not found" và hiện nút quay lại danh sách; thêm vào UX-037 (không có Retry).
- Dashboard: khối "Form: last 10 predictions" toàn ô `-` khi 10 prediction mới nhất đều Pending (dữ liệu đúng nhưng nhìn như hỏng); nên lấy 10 pick đã settle gần nhất.
- Prediction detail 390px: tab strip cuộn ngang không có dấu hiệu (ẩn Stats, Monte Carlo, Raw payload); bảng Picks chỉ thấy tới cột Stage, cột Result và nút Recalculate/Override nằm ngoài khung nhìn. Ảnh: `backlog-screenshots/UX-r3-prediction-detail-mobile.png`. Gợi ý: dạng thẻ dưới 600px (cùng gốc UX-011).
- Effort: S.

## Đã kiểm ở vòng 3, hoạt động tốt

- Authz: quét 36 route từ controller bằng curl: anonymous đều 401 (trừ login 400); viewer đọc được các GET, mọi POST/PUT/PATCH quản trị đều 403, `GET /prompts/{id}/for-agent` 403. Route lạ dưới `/api/v1` ra 404 JSON.
- Không dùng `innerHTML`/`bypassSecurityTrust*`/`outerHTML` ở bất kỳ file nào trong `matchmind-web/src` (ngoài spec); Chart.js vẽ canvas nên tên đội/model không chạy được HTML.
- Validation phía agent: điểm âm hoặc 999, odds ≤ 1, probability > 1, line không chia hết 0,25, pick/market không khớp odds, `startTime` không có múi giờ hoặc chỉ ngày: đều 400 với `fieldErrors` rõ (riêng `startTime` chỉ báo "wrong type or format", nên ghi rõ "ISO-8601 có múi giờ, ví dụ 2026-11-21T20:00:00Z").
- Hiệu năng với ~370 prediction: mọi GET (`predictions?size=100`, dashboard, reports, api-logs, models) dưới 25 ms, 84 KB cho 100 hàng; `/reports?tab=history` dựng 50 hàng trong ~220 ms, không có long task.
- Reflow 320x256 (tương đương zoom 400%): không cuộn ngang cấp trang ở Dashboard, Import, Settings, Prompts, Reports, Models, Predictions (bảng cuộn trong khung của nó). `prefers-reduced-motion` được xử lý trong CSS. Không có dark mode (plan.md ghi light là mặc định, chấp nhận được).
- A11y: tiêu đề cột sort có `aria-sort` và là nút; tất cả phần tử tương tác có tên; vùng cuộn của bảng chứa phần tử focus được; input mật khẩu có `autocomplete` đúng; toast nằm trong vùng `aria-live="polite"`.
- Đổi mật khẩu: sai mật khẩu hiện tại 400 `BAD_CURRENT_PASSWORD`, mật khẩu mới < 10 ký tự 400; sau khi đổi, token cũ 401 ngay.
- Cache tĩnh: `index.html` no-cache, file băm tên immutable.

## Việc chưa kiểm tra (để vòng sau)
- Build lại image rồi kiểm lại UX-054 và `ping` (xem bổ sung ở trên). Việc này thuộc agent giữ stack Docker.
- Đăng xuất admin thật và nút Back của trình duyệt (token admin dùng chung nên bỏ qua; nên thử bằng user riêng).
- Screen reader thật (NVDA/VoiceOver), RTL, in ấn, zoom 200% ở dialog Override.
- Sau khi sửa UX-063: kiểm `resultAt` sát giờ hiện tại (lệch đồng hồ giữa agent và server).

---

# Vòng 4 (UX Reviewer, Agent 1) — góc nhìn: IP/rate limit và audit, xuất dữ liệu, múi giờ, đơn vị số liệu, bàn phím và đọc màn hình, đăng xuất bằng user riêng

Phạm vi: đăng nhập chỉ bằng bàn phím, đăng xuất rồi bấm Back (user viewer riêng), route trực tiếp của viewer, export CSV, bucket theo múi giờ của Dashboard, header cache, spoof IP,
rate limit login và `/external/**`, tên provider/model lạ, mã lỗi `Content-Type`, đối chiếu số liệu Predictions với Dashboard, dialog ở 320x400, focus khi đổi route.
Ghi chú môi trường: container API/web vẫn là bản 18:02/18:04 (cũ hơn working tree), nên kết quả dưới đây là của bản đang chạy; một số mục có thể đã được sửa trong working tree
(ví dụ bộ lọc trên URL, `ApiLogRetention`). Dữ liệu thử đã tạo: provider `ux-review-d`, `ux-review-e`, `ux-review-f` (0 prediction), model `SharedName` (2 provider), trận `uxr4-*`,
user `ux9-viewer` (còn Active), khoảng 160 dòng API Logs 401/429 từ các thử nghiệm bên dưới (`errorMessage` "Invalid API key"). Không xoá dữ liệu nào.

## Bảo mật: IP, rate limit, audit

### UX-072 — Medium — Security — `X-Forwarded-For` của client được tin
- Cấu hình: `matchmind-web/nginx.conf` có `set_real_ip_from 172.16.0.0/12; set_real_ip_from 192.168.0.0/16; real_ip_header X-Forwarded-For; real_ip_recursive on;`
  (đã xác minh cùng nội dung trong container `/etc/nginx/conf.d/default.conf`). Docker Desktop/NAT nội bộ và mọi máy LAN `192.168.x.x` nối thẳng vào cổng 8088 đều nằm trong dải "tin cậy".
- Repro 1 (audit): `curl -X POST localhost:8088/api/v1/external/predictions -H "X-Api-Key: x" -H "X-Forwarded-For: 203.0.113.77" -H "X-Provider: ux-review-d" -d '{}'` rồi mở API Logs: `clientIp = 203.0.113.77`. Agent hoặc người dùng LAN tự chọn IP hiện trong log.
- Repro 2 (nginx `limit_req`, 10 r/s burst 50): 100 request song song cùng IP cho 73 x 401 + 27 x 429; 100 request song song với `X-Forwarded-For: 198.51.100.<i>` khác nhau cho 100 x 401, không cái nào bị 429.
- Repro 3 (login): request `X-Forwarded-For: 9.9.9.9` tới `/auth/login` trả 401 trong khi request cùng lúc không có header trả 429, tức là bộ đếm IP của `LoginRateLimiter` bị né.
- Hậu quả: mọi giới hạn dựa trên IP (login 20 lần/5 phút, nginx 10 r/s) và cột "Client IP" của audit đều giả được từ trong mạng nội bộ. UX-013 nêu IP thật chưa tới API; đây là mặt ngược lại.
- Mong đợi: chỉ `set_real_ip_from` đúng IP của reverse proxy phía trước (cấu hình bằng biến môi trường/compose), không dùng cả dải `/12` và `/16`; hoặc nginx ngoài cùng tự ghi đè `X-Forwarded-For` bằng `$remote_addr`.
  Thêm bước curl kiểm tra cấu hình trong CI.
- Effort: S.

### UX-073 — Medium — Security / Perf — Request sai key cũng ghi DB và không bị giới hạn ở tầng app
- Repro: 60 `POST /external/predictions` liên tiếp với `X-Api-Key: wrong-N` (2 giây): 60 x 401, không khoá, không trì hoãn (khoảng 27 ms mỗi cái). API Logs thêm đúng 61 dòng (`providerId: null`, `errorMessage: "Invalid API key"`, `durationMs: 0`).
- Mỗi request chưa xác thực là một `INSERT` vào `api_logs`. Kết hợp UX-072 (né `limit_req`) thì kẻ không có key làm đầy bảng và đẩy dòng lỗi thật của agent ra khỏi 50 dòng đầu. `ApiLogRetention` (xoá sau 90 ngày) có trong working tree nhưng chỉ dọn theo ngày, không chặn tốc độ.
- Mong đợi: (1) giới hạn lỗi key theo IP/phút ở tầng app (429 + `Retry-After`); (2) gom các dòng 401 không có provider thành một dòng đếm theo phút/IP thay vì mỗi request một dòng; (3) bộ lọc "ẩn lỗi xác thực" trong API Logs.
- Effort: S.

### UX-074 — Medium — Bug / UX — Giới hạn IP của login đếm cả lần thành công và cả team dùng chung
- Repro: trên stack đang chạy, vài phiên đăng nhập (trình duyệt + curl) cộng 5 lần sai với 2 username lạ trong cùng 5 phút. Kết quả: `admin` (mật khẩu đúng) và `ux9-viewer` (chưa từng sai) đều `429 LOGIN_RATE_LIMITED "Too many login attempts. Try again in 3 minute(s)"`, `Retry-After: 161`.
- Nguyên nhân (đọc `LoginRateLimiter.acquire`): `ipAttempts` tăng ở mỗi lần gọi (kể cả thành công), ngưỡng 20 trong 5 phút; mọi client sau Docker NAT có cùng IP `172.21.0.1`. Với team nhỏ, hoặc bộ E2E chạy song song, cả nhóm bị khoá cùng lúc; admin không có cách mở khoá (UX-043).
  Lưu ý: các agent khác trong cùng phiên review này cũng đăng nhập từ cùng IP nên bộ đếm chung đã đầy; đây đúng là tình huống thật của một team dùng chung một IP.
- Mong đợi: chỉ đếm lần thất bại theo IP, ngưỡng cao hơn (ví dụ 30 lần sai/5 phút); form đăng nhập hiện đếm ngược từ `Retry-After`; đi kèm UX-072 để IP có nghĩa.
- Effort: S.

## Số liệu và định nghĩa

### UX-075 — Medium — UX / Data — "Result" ở Predictions chỉ là kết quả của top pick
- Repro: `/predictions`, chọn Result = Win, bấm Apply: 5 prediction. Cùng lúc Dashboard ghi 35 Win, `GET /reports/prediction-history?result=WIN` ra 35 pick (449 pick tổng). Ảnh: `backlog-screenshots/UX-075-predictions-result-filter-top-pick.png`.
  Cách tính trong `PredictionQueryService.list`: `r.result = :topResult` (chỉ pick rank 1); cột "Result" cũng chỉ là top pick, cột "Picks" cho biết có nhiều hơn.
- Vấn đề: cùng chữ "Result/Win" nhưng đơn vị khác nhau giữa các màn (prediction theo top pick và pick). Người dùng đối chiếu 5 với 35 sẽ nghĩ dữ liệu sai; prediction có 3 pick (Win, Loss, Win) hiện "Win" hoặc "Loss" tuỳ top pick.
- Mong đợi: đổi nhãn thành "Top pick result" (cột và bộ lọc), thêm tooltip "2 Win · 1 Loss" tổng các pick, hoặc bộ lọc "Có ít nhất 1 pick Win". Ghi đơn vị dưới tiêu đề ("375 predictions · 449 picks").
- Effort: S.

### UX-076 — Low — UX — Không giải thích cách tính win rate
- `API_DOCUMENTATION.md` định nghĩa `(WIN + HALF_WIN) / (WIN + HALF_WIN + LOSS + HALF_LOSS)`, nhưng UI (Dashboard, Models, Reports) chỉ hiện "Win rate" và phần trăm. Half loss (mất nửa stake) tính như thua trọn, Half win như thắng trọn;
  dữ liệu hiện tại: 35 W, 54 L trong đó 26 là half loss, win rate 39,3%. Một model toàn Half win và Half loss có win rate trông như 50/50 dù lợi nhuận khác hẳn (liên quan UX-018, UX-006).
- Mong đợi: tooltip/ghi chú dưới thẻ "Win rate = (Win + Half win) / pick đã settle, không tính Push/Void", hoặc thêm "Win rate theo trọng số" (nửa = 0,5). Effort: S.

## Agent API và dữ liệu

### UX-077 — Low — UX / Data — Provider sinh ra từ request bị từ chối, trùng tên model giữa provider
- Repro: `POST /external/predictions` với `X-Provider: ux-review-f` và `model.name` dài 300 ký tự: `400 VALIDATION_ERROR "size must be between 0 and 128"`. Sau đó `GET /providers` có `ux-review-f` (`models: 0`, `predictions: 0`, `lastCallbackAt` vừa rồi).
  Một lỗi gõ ở `X-Provider` tạo luôn provider mới và không có cách xoá hay ẩn (UX-002). (Header đã được chuẩn hoá chữ thường: `UX-REVIEW-D` vào đúng `ux-review-d`, tốt.)
- Dropdown "AI model" (Predictions, Reports, Dashboard) hiện hai dòng `SharedName 1` khi hai provider cùng gửi model tên `SharedName` v1; Models và Reports có cột Provider nhưng bộ lọc thì không. Chọn nhầm thì lọc sai model mà không biết.
- Mong đợi: chỉ tạo provider/model sau khi payload qua validation; dropdown ghi `SharedName 1 (ux-review-e)`. Effort: S.
- Đã kiểm, đúng: `X-Provider` chứa HTML bị `400 INVALID_PROVIDER` ("2-64 characters: a-z, 0-9, '-' or '_'"); trống bị `400 PROVIDER_REQUIRED`; gửi prediction PRE_MATCH vào trận đã `FINISHED` bị `409 MATCH_ALREADY_FINAL` (chặn dự đoán sau khi biết kết quả: tốt).

### UX-079 — Low — UX — Bộ lọc, xuất dữ liệu, thông báo lỗi
- Predictions: đổi ô chọn "Result" thành Win, bảng vẫn 375 dòng cho tới khi bấm "Apply" (không có dấu hiệu "bộ lọc chưa áp dụng"). Người quen lọc tức thì sẽ tưởng bộ lọc hỏng.
- Chỉ `Reports > Prediction history` có CSV/Excel (`/reports/prediction-history/export`, tối đa 50 000 dòng, vượt thì `400 EXPORT_TOO_LARGE` rõ ràng, CSV có BOM). Thời gian trong CSV là UTC (`2036-11-20T10:00:00Z`) trong khi UI hiện giờ địa phương: nên ghi chú "UTC" hoặc thêm cột giờ địa phương.
  Predictions, Matches, AI Models, API Logs không có export; power user phải gọi API.
- `POST /external/matches/results` với `Content-Type: text/plain` hoặc không có header: `415 {"code":"UNSUPPORTED_MEDIA_TYPE","message":"Unsupported Media Type"}`; agent/GPT Action cần câu "Gửi Content-Type: application/json". Lỗi trường kiểu "size must be between 0 and 128" nên là "model.name tối đa 128 ký tự".
- Effort: S.

## Trợ năng và bàn phím

### UX-078 — Low — A11y — Focus khi đổi route, form mật khẩu, dialog
- Đổi route (bấm "Matches" ở menu): `document.activeElement` vẫn là link menu, `<h1>` và `<title>` đổi nhưng không có thông báo; người dùng screen reader/bàn phím phải Tab qua cả menu để tới nội dung mới. Gợi ý: sau `NavigationEnd` focus vào `<h1 tabindex="-1">` hoặc `<main>`, hoặc ghi tiêu đề vào vùng `aria-live`.
- Settings > Change password: Chrome log `[DOM] Password forms should have (optionally hidden) username fields`; thêm `<input autocomplete="username" hidden>` mang username hiện tại để trình quản lý mật khẩu cập nhật đúng tài khoản.
- Prediction detail > Picks: nút mở rộng có `aria-expanded` (tốt) nhưng thiếu `aria-controls`.
- Dialog Override ở 320x400 (tương đương zoom 400%): dialog cuộn được nhưng nút "Cancel/Save override" nằm dưới đáy khung (top 385 > đáy dialog 380) nên phải cuộn trong dialog; footer nên `position: sticky; bottom: 0`.
- Effort: S.

### UX-083 — Medium — Bug / A11y — Esc không đóng dialog
- Repro: `/predictions/<id>`, bấm "Override" (hoặc `/settings` > "Add user"), bấm Escape (1 hoặc 2 lần). Dialog vẫn mở (`dialog.open === true`, `:modal`), focus ở nút Close. Đối chứng cùng phiên, cùng trình duyệt/driver: tạo một `<dialog>` trần, `showModal()`, bấm Escape: đóng ngay.
  Nên nguyên nhân nằm ở app, không phải driver.
- Nguyên nhân (đọc `shared/kit.ts`, `Dialog`): `<dialog (cancel)="!closable() && $event.preventDefault()">`. Khi `closable()` là true biểu thức là `false && …` = `false`, và Angular coi handler trả về `false` là yêu cầu `preventDefault()` (hành vi cũ của event binding), nên sự kiện `cancel` do Esc bị chặn. Chú thích trong `onNativeClose` ("Chrome closes a modal on a second Esc even when cancel is prevented") cho thấy tác giả đã thấy hiện tượng này mà chưa tìm ra gốc.
- Sửa: `(cancel)="onCancel($event)"` với `onCancel(e) { if (!this.closable()) e.preventDefault(); }`, thêm test spec (dispatch `cancel` ở dialog closable thì `closed` được emit). Kiểm cả hộp xác nhận (`ConfirmService`) và drawer mobile (UX-036).
- Hậu quả: người dùng bàn phím/screen reader và mọi người quen Esc phải tìm nút Close/Cancel; vi phạm mẫu ARIA modal dialog (Esc đóng) và WCAG 2.1.1 ở mức mong đợi.
- Effort: S.

## Phân trang

### UX-080 — High — Bug — "Rows per page" làm hỏng danh sách
- Repro (bản đang chạy `http://localhost:8088`, đăng nhập admin): `/matches` (hoặc `/predictions`, `/api-logs`, `/reports?tab=history`), đổi ô "25 / page" sang 50 bằng chuột hoặc bàn phím (ArrowDown).
  Kết quả: chân bảng "NaN–NaN of 130 matches", ô chọn trống, bảng chỉ còn 20 hàng (mặc định của server); bấm "Next page" thì `GET /matches?page=NaN&sort=startTime,desc` trả `400`, bảng 1 hàng lỗi, "0–NaN of 0 matches", "Page NaN of NaN"; chỉ F5 mới phục hồi. Ảnh: `backlog-screenshots/UX-080-rows-per-page-nan.png`.
- Network: `GET …?page=0&size=50…` bị huỷ (`net::ERR_ABORTED`) rồi một request thứ hai không có `page/size` thắng.
- Nguyên nhân (đọc `shared/kit.ts`, `Paginator`): component khai báo `readonly change = output<{page; size}>()` và template trang dùng `<mm-paginator (change)="list.setPage($event)">`. `<select (change)>` bên trong phát sự kiện DOM `change` nổi bọt lên thẻ `<mm-paginator>`,
  nên `setPage` bị gọi lần hai với đối tượng `Event` (không có `page`/`size`) và ghi đè `size` thành `undefined`. Nút First/Prev/Next dùng `click` nên không dính; chỉ ô chọn kích thước trang hỏng.
- Sửa: đổi tên output thành `pageChange` (và 6 chỗ dùng ở api-logs, matches, predictions, reports x3), hoặc gọi `e.stopPropagation()` trong `resize`. Thêm test: đổi select rồi kiểm `size()` bằng số và `Page 1 of N`.
  Bản `paged-list.ts` trong working tree (URL state) vẫn dùng cùng `setPage`, nên cần kiểm lại sau khi build.
- Effort: S. Vì là điều khiển cơ bản của 4 màn hình nên đặt High dù sửa chỉ một dòng.

## Model detail và onboarding

### UX-081 — Medium — Missing feature — Trang AI Model là ngõ cụt
- Repro: `/models/<id>` của model có 301 prediction (`ux-perf`): "Latest predictions" chỉ có khoảng 15 hàng, không có "Xem tất cả 301", không phân trang, không có biểu đồ (`canvas` = 0), không có xu hướng win rate theo ngày/tuần.
  Link duy nhất ra ngoài là "AI models". Ảnh: `backlog-screenshots/UX-081-model-detail-small-sample.png` (thẻ Win rate đen, lớn, "100.0%" từ 1 pick đã settle, không có "n = 1").
- plan.md §12 yêu cầu "Recent predictions" và "Model performance"; plan §7 có "Win rate over time" cho Dashboard nhưng model nào cũng cần xem được diễn biến riêng.
- Mong đợi: link "Xem tất cả" sang `/predictions?modelId=<id>` (bộ lọc `modelId` đã có trong working tree), biểu đồ win rate theo tuần với đường tin cậy hoặc nhãn "n nhỏ", badge "mẫu nhỏ (n < 30)" cạnh thẻ Win rate (nhắc lại UX-018).
- Effort: M.

### UX-082 — Low — UX — Import cho người mới
- Repro: `/import` lần đầu (hoặc người dùng chưa từng chạy agent). Mô tả: "When an agent replies CANNOT_CALL_API, paste its whole reply below…". Không giải thích `CANNOT_CALL_API` là gì và lấy ở đâu; ô Agent reply có placeholder `CANNOT_CALL_API / X-Model-Name: … / { … }` nhưng không có nút mẫu.
  Ảnh: `backlog-screenshots/UX-082-import-first-time.png`. Không link sang Prompt Notes, nơi có prompt dặn agent trả đúng định dạng, nên người mới không biết thứ tự: lấy prompt → dán vào agent → dán câu trả lời vào đây.
- Mong đợi: 3 bước ngắn ở đầu trang (kèm link "Prompt Notes"), nút "Dán ví dụ" dùng `docs/samples/prediction-pre-match.json`, link "Nếu agent gọi được API thì không cần trang này" tới hướng dẫn kết nối (UX-020). Ghi chú: ô "chatgpt/gpt-5.1" placeholder trông như đã điền (UX-066).
- Effort: S.

## Đã kiểm ở vòng 4, hoạt động tốt

- Đăng nhập chỉ bằng bàn phím: Tab đi đúng username, password, nút; Enter ở ô mật khẩu đăng nhập; `returnUrl` được giữ (`/login?returnUrl=%2Fpredictions` rồi về đúng trang).
- Đăng xuất (user viewer riêng) rồi bấm Back: trình duyệt về `/login?returnUrl=%2Fpredictions`, không hiện lại dữ liệu cũ.
- Viewer mở thẳng `/import`: thấy trang kèm dòng "Only an admin can import", không có nút gửi (menu cũng ẩn Import); `/api-logs` vẫn mở được (UX-026 đã nêu).
- Header cache: mọi `GET /api/v1/*` có `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`; `index.html` `no-cache`.
- Dashboard `tz`: `winRateOverTime` chia ngày đúng theo múi giờ (UTC, Asia/Bangkok, Pacific/Auckland, America/Los_Angeles cho các `day` khác nhau, đúng biên ngày); chỉ trả ngày có dữ liệu (không sinh 3650 điểm khi có prediction năm 2036); dưới 50 ms với 375 prediction.
  Ngày của biểu đồ là ngày `predictedAt`, không phải ngày settle: kết quả sửa muộn đổi cột của ngày cũ.
- Sort: `NULLS LAST` cho cả ASC/DESC; phân trang không trùng dòng giữa các trang (kiểm 3 trang x 100).
- CSV history: khớp số pick (446 dòng so với 445 pick, 1 pick mới tạo trong lúc thử), có BOM; vượt 50 000 dòng có lỗi rõ.
- Đăng nhập: username lạ và sai mật khẩu cùng `401 BAD_CREDENTIALS`, thời gian xấp xỉ (220–245 ms): không lộ username có tồn tại không.
- Lỗi 404 `PREDICTION_NOT_FOUND`/`MATCH_NOT_FOUND` rõ; API key trên query string không được chấp nhận (401).

## Việc chưa kiểm tra (để vòng sau)
- Sau khi build lại stack từ working tree: kiểm lại UX-010 (filter trên URL, đã có `url-state.ts`), UX-054, `ping`, UX-072 (nginx.conf), UX-073 (retention).
- Sau khi sửa UX-083: Esc trên mọi dialog, hộp xác nhận và drawer mobile; screen reader thật cho đổi route và bảng có dòng mở rộng.
- Test E2E song song sẽ chạm UX-074 (429): kiểm lại sau khi sửa với 3 phiên đăng nhập đồng thời.
- Sau khi sửa UX-080 và build lại: thử `?page=abc&size=abc` và `?size=9999` trên bản có URL state, kiểm `Page 1 of N` sau mỗi lần đổi kích thước trang ở 4 màn hình.

---

# Vòng 5 (UX Reviewer, Agent 1) — góc nhìn: dữ liệu độc từ agent làm hỏng UI, đồng thời/race, phiên và đăng xuất, mobile/tap target, khớp plan.md

Phạm vi: gửi dữ liệu biên qua Agent API rồi xem UI (thời gian dạng số, không offset, chuỗi lạ), race 12 request song song (idempotency) và 6+4 override/recalculate song song,
đăng xuất nhiều phiên, 150 luồng SSE, đo mobile 390px trên cả 9 màn hình, định dạng dán vào Import, copy clipboard, Swagger, settle LIVE `REMAINING_MATCH`, quét console/network toàn route.
Ghi chú môi trường: stack đang chạy vẫn là bản cũ hơn working tree (chưa có URL state cho filter, chưa có dark mode). Dữ liệu thử: provider `ux-review-r5`, model `r5-model`, `r5-live`,
trận `r5-*`, user `ux10-viewer` (đã Disable). Ba giá trị "độc" do chính tôi tạo (UX-084: `startTime`, `predictedAt`, `result_updated_at`) đã được sửa lại bằng `UPDATE` trên đúng 3 dòng đó để UI dùng chung không bị hỏng; không xoá gì khác.

## Agent API: thời gian và lỗi validation

### UX-084 — High — Bug / Data integrity — Thời gian dạng số làm trắng bảng Matches, Predictions, AI Models
- Repro: `POST /api/v1/external/predictions` (header như doc) với `"match":{"startTime":1796000000000,...}` hoặc `"predictedAt":1796000000000` (epoch milli, kiểu JS `Date.now()`). Trả `201`.
  API đọc số như epoch GIÂY nên lưu năm 58882 (`startTime` xuất ra `+58882-12-22T00:53:20Z`, dạng ISO mở rộng có dấu `+`). Số nhỏ `1796000000` (giây) cũng được nhận (`2026-11-30T00:53:20Z`) trong khi chuỗi không offset bị từ chối (UX-085): hai quy tắc ngược nhau.
- Actual: mở `/matches` thì console `ERROR RangeError: Invalid time value at fmt`, bảng chỉ còn các ô `:` rỗng, chân bảng "0–0 of 0 matches". Với `predictedAt` thì `/predictions` ("0–0 of 0 predictions") và `/models` (cột Last prediction) hỏng theo. Ảnh: `UX-084-matches-invalid-time.png`, `UX-084-models-invalid-time.png`.
  Dòng độc luôn ở trang 1 vì mặc định sort Kick-off/Predicted giảm dần, nên mọi admin và viewer đều thấy trang trắng cho tới khi có người sửa DB. Vẫn vào được trang chi tiết bằng URL.
  `resultAt` dạng số trong `POST /external/matches/results` (`1796000000000`) cũng được nhận (200, `FINISHED`): `resultUpdatedAt` thành `+58882-12-22T00:53:20Z` và trang Match detail của trận đó ném cùng `RangeError` (ảnh `UX-084-match-detail-result-updated.png`); admin không sửa được qua UI (ngoài UX-001 thì lần gửi sau còn bị `STALE_RESULT`, UX-063).
- Expected: (1) API nhận `Instant` chỉ ở dạng chuỗi ISO-8601 có `Z`/offset (tắt `ALLOW_NUMERIC_TIMESTAMPS` / `READ_DATE_TIMESTAMPS_AS_NANOSECONDS` cho DTO external), và kiểm khoảng hợp lý (vd 2000..hiện tại + 5 năm; gộp với UX-028 và UX-063 đã nêu tương lai +10 năm và `resultAt` 2036).
  (2) UI: `fmt()` trong `shared/format.ts` trả `—` khi `isNaN(date)` thay vì ném (rule của repo: thiếu số thì hiện `—`); lỗi một ô không được làm trắng cả bảng.
  (3) Test: một case có `startTime` năm 58882 trong `pages.spec.ts`.
- Effort: S. Đây là kiểu "một agent gửi sai là hỏng cho cả team", nên giữ High dù khó xảy ra với agent viết đúng prompt.

### UX-085 — Medium — UX — Lỗi thời gian không nói định dạng mong đợi
- Repro: cùng payload với `"startTime":"2026-12-05T20:00:00"` (không `Z`), `"2026-12-05"` hoặc `"2026-12-05 20:00"` trả `400 INVALID_FIELD_TYPE`, `message: "A field has the wrong type or format"`, `fieldErrors: {"match.startTime":"wrong type or format"}`.
  Offset hợp lệ (`+07:00`) được nhận đúng (lưu `13:00Z`); `+25:00` bị từ chối.
- Actual: LLM agent đọc lỗi này không biết sửa thế nào (thiếu offset là lỗi rất hay gặp).
- Expected: thông báo theo trường: `match.startTime must be an ISO-8601 instant with Z or an offset, e.g. 2026-12-05T20:00:00Z`, áp dụng cho `predictedAt`, `resultAt`, `capturedAt`. Cân nhắc nhận chuỗi không offset và gán UTC kèm cảnh báo trong `warnings[]` (đổi contract, chỉ nếu chấp nhận rủi ro lệch múi giờ).
- Effort: S.

### UX-096 — Low — Bug — Tên "vô hình" và ký tự điều khiển
- Repro: `homeTeam` là `"​​"` hoặc `" "` trả `201` (`@NotBlank` không coi U+200B và NBSP là khoảng trắng). `homeTeam:"A\nB\tC"` cũng được lưu nguyên. JSON có `"\ud800"` (surrogate lẻ) cũng được nhận. Chuỗi 300 ký tự, league 5000 ký tự, `externalMatchId` 300 ký tự bị từ chối đúng (giới hạn 160/128).
- Actual: trận có đội tên rỗng nhìn thấy: link không có tên truy cập được, không tìm được, CSV có ô trống.
- Expected: chuẩn hoá khi nhận (NFKC, bỏ ký tự zero-width/BOM, gộp khoảng trắng, bỏ điều khiển) rồi mới kiểm `blank`; UI đã escape nên chưa có XSS.
- Effort: S.

## Dữ liệu và tính toàn vẹn

### UX-088 — Medium — Security / Data integrity — Immutability chỉ nằm ở Java
- Kiểm: `information_schema.triggers` trống (0 trigger); `role_table_grants` cho role `matchmind` có `UPDATE` và `DELETE` trên `predictions` và `prediction_pick_results`. `UPDATE predictions SET predicted_at=... WHERE id=...` chạy được (`UPDATE 1`); tôi dùng đúng cách đó để gỡ dòng độc ở UX-084 (dòng thử của tôi).
- AGENTS.override.md: "Prediction rows are immutable snapshots", "Settlement results are append-only", "Integrity lives in the database too". Hiện chỉ `@Immutable` của JPA giữ; migration, script ops hay một bug mới trong JDBC repository đều ghi đè được snapshot hoặc xoá lịch sử settle.
- Expected: migration mới `V<n>__immutable_snapshots.sql`: trigger `BEFORE UPDATE OR DELETE` trên `predictions`, odds, picks, stats, simulations (raise exception); trên `prediction_pick_results` chỉ cho `UPDATE` khi chỉ `is_current`/`superseded_at` đổi, cấm `DELETE`. Thêm IT kiểm trigger. Muốn `REVOKE` thì cần tách role migration (Flyway) và role runtime.
- Effort: M.

### UX-095 — Medium — UX — Pick LIVE tính theo "remaining" không được giải thích ở danh sách
- Repro: prediction LIVE phút 55, tỉ số lúc chụp 1:0, `OU 2.5 OVER` và `AH HOME -0.25` với `settlementBasis: REMAINING_MATCH`, `scoreAtCapture 1:0`; kết quả trận 2:1. Engine đúng: OU = LOSS (còn 1 bàn sau phút 55), AH = HALF_LOSS (remaining 1:1).
- Actual: danh sách Predictions hiện "OU OVER 2.5 · Live · 2 : 1 · Loss"; tab Picks hiện "OVER 2.5 Live 55.0% 1.90 Loss"; Dashboard "Needs review" cũng không có basis. Người xem thấy 3 bàn mà "Over 2.5" thua nên nghĩ engine sai. Chỉ tab Odds có cột Basis "Remaining match" và At capture "1 : 0". Ảnh: `UX-095-live-remaining-basis.png`.
- Expected: badge nhỏ cạnh line `from 1:0` (tooltip: "Tính trên bàn thắng sau lúc chụp: 1 bàn"), cột Basis trong tab Picks, "rem." trong dòng danh sách khi basis là REMAINING_MATCH. API đã có `settlementBasis` trong odds nên chỉ cần đưa ra pick/list (đổi contract nhẹ cho `GET /predictions`: thêm `topPickBasis`).
- Effort: S.

### UX-086 — Medium — UX / Data — Filter League khớp chính xác
- Repro (API và UI giống nhau): `league=UX%20League%20R2` ra 18; `ux%20league%20r2` ra 0; `UX%20League%20R2%20` (thừa dấu cách) ra 0; `League%20R2` ra 0; `premier` ra 0 (nhưng ô tìm `search=premier` ra 34). UI chỉ có `<datalist>` gợi ý 18 tên, gõ sai không có thông báo nào ngoài "0–0 of 0".
- Actual: league do agent tự khai ("Premier League", "English Premier League", "EPL") nên cùng một giải bị chia mảnh; Reports/Dashboard theo league cũng chia mảnh. Không có màn hình gộp hay alias.
- Expected: (S) so khớp `lower(trim())` và hỗ trợ tiền tố; trong UI "0 kết quả cho league 'x'. Gợi ý: ..." (L) bảng `leagues` chuẩn với alias do admin gộp, import tự map.
- Effort: S cho phần so khớp, L cho alias.

## Phiên, bảo mật, vận hành

### UX-090 — Medium — UX / Security — Đăng xuất = đăng xuất mọi thiết bị
- Repro: tạo user thử `ux10-viewer` (admin), đăng nhập 2 lần ra token A và B, cả hai `GET /dashboard` 200. `POST /auth/logout` bằng token A (204). Sau đó A = 401 và B = 401.
- Code: `AuthService.logout` tăng `token_version` ("Invalidates every token of the user"). Nút UI chỉ ghi "Sign out".
- Actual: bấm Sign out trên điện thoại làm máy tính đang mở prompt/override bị văng (UX-048: hộp native chặn, UI zombie). Script dùng JWT của admin cũng chết. Đổi mật khẩu có dòng "signs you out everywhere", đăng xuất thì không.
- Expected: hoặc (S) đổi nhãn/xác nhận "Sign out on all devices"; hoặc (M) logout chỉ thu hồi phiên hiện tại (bảng `user_sessions` / claim `jti`) và thêm nút riêng "Sign out everywhere" ở Settings.
- Effort: S đến M.

### UX-089 — Low — Security / Perf — SSE không giới hạn
- Repro: 100 rồi 150 `GET /events/predictions` song song với một token (viewer cũng được), tất cả `200`, không bị từ chối; `GET /dashboard` vẫn 23–39 ms. POST agent trong lúc 150 luồng mở mất 63 ms so với 24 ms lúc không có luồng.
- Code: `PredictionEvents.send` lặp tuần tự trên thread của request agent (đã có comment `ponytail:`); danh sách `streams` không có trần. Một client chậm đọc sẽ kéo chậm callback của agent.
- Expected: tối đa N luồng cho mỗi user (vd 5, đóng luồng cũ nhất) và tổng (vd 200); `send` chuyển sang executor nhỏ với timeout từng luồng. UX-064 (đóng luồng khi thu hồi) đã có 30 phút tuổi thọ trong working tree.
- Effort: S.

### UX-091 — Medium — Bug / UX — Copy không có fallback khi không có `navigator.clipboard`
- Code: `shared/kit.ts` `ToastService.copy`: `if (!navigator.clipboard) { fail(); return; }` rồi toast "Select the Prompt with the API key and copy it manually". `docker-compose` mở web ở `127.0.0.1:8088`, nhưng khi chạy trên máy chủ nội bộ hoặc mở từ điện thoại qua `http://<IP-LAN>:8088` thì trang không phải secure context, `navigator.clipboard` là `undefined`.
- Actual: nút Copy ở Prompts (và Import "Copy JSON") luôn báo lỗi. Với admin, văn bản có API key chỉ nằm trong clipboard (UI hiển thị `{{EXTERNAL_API_KEY}}`), nên lời khuyên "chọn và copy thủ công" không làm được.
- Expected: fallback `document.execCommand('copy')` qua `<textarea>` ẩn; nếu vẫn lỗi thì mở dialog chứa văn bản (admin: nút "Reveal key" có xác nhận) để chọn tay.
- Lưu ý: chưa chạy thực tế trên HTTP LAN, kết luận từ code. Effort: S.

### UX-094 — Low — Docs / Ops — Swagger và đường dẫn không khớp tài liệu
- Repro: `curl http://localhost:8088/swagger-ui.html` và `/v3/api-docs` trả `200 text/html` (index.html của SPA); mọi đường dẫn lạ khác ngoài `/api` cũng 200. Trên `:8090` thì `/swagger-ui.html` 404 vì `.env` đặt `SWAGGER_ENABLED=false` (đúng cho production).
- `docs/API_DOCUMENTATION.md` dòng 6 ghi "Interactive docs: `/swagger-ui.html` and `/v3/api-docs`", README ghi cổng 8090, nginx không proxy; plan.md §14 yêu cầu OpenAPI documentation.
- Expected: doc ghi rõ "chỉ cổng 8090 và chỉ khi `SWAGGER_ENABLED=true`"; nginx trả 404 cho `/v3/*`, `/swagger-ui*` thay vì index.html (giám sát và scanner không bị đánh lừa bởi 200). Tuỳ chọn: xuất `openapi.json` vào `docs/` khi build.
- Effort: S.

## UI chi tiết

### UX-087 — Low — A11y / UX — Mobile 390px: hành động bị cắt, ô nhập nhỏ, tap target
- Đo trên 9 màn hình ở 390px: không có cuộn ngang cấp trang (375 = 390 trừ thanh cuộn). Nhưng:
  - Settings: bảng Users cắt từ cột "Last…", nút Disable/Reset password (hành động chính) nằm ngoài khung, không có bóng mờ/gợi ý cuộn. Ảnh: `UX-087-settings-mobile-users.png`. Match detail: bảng "Models on this match" cũng cắt cột "Pre…".
  - Cỡ chữ: 25 `<select>` ở Settings 12,8px (cao 30px) và 3 ô mật khẩu 14px; iOS Safari tự phóng to trang khi focus ô < 16px. Matches có 6, API Logs 7, Import 4 ô như vậy.
  - Tap target: tiêu đề cột có sort (cao 19px), link tên trận trong bảng (19–21px), "All predictions" (23px). WCAG 2.2 SC 2.5.8 yêu cầu tối thiểu 24x24 CSS px.
- Expected: `font-size: 16px` cho input/select ở `@media (max-width: 640px)`; padding cho link/nút sort để cao tối thiểu 24px (khuyến nghị 40px); thêm gradient mờ hoặc dạng thẻ (card) cho Users trên mobile.
- Effort: S.

### UX-092 — Low — UX — Monte Carlo không ghi cỡ mẫu
- `GET /reports/monte-carlo` trả `simulatedPredictions: 34`, `finishedPredictions: 26`, `correctScoreHits: 0`, `correctScoreAccuracy: 0.0`; UI chỉ có thẻ "Correct score accuracy 0.0%" và "Simulated predictions 34".
- Expected: "0.0% (0/26 trận đã xong)" và "Avg actual remaining goals 2.00 (26 trận)"; `—` khi `finishedPredictions = 0`. Gộp ý tưởng với UX-076/UX-081.
- Effort: S.

### UX-093 — Low — UX — Import: dấu nháy cong và dấu phẩy thừa
- Kiểm 5 dạng dán vào "Agent reply": (a) `CANNOT_CALL_API` + `X-Model-Name` + code fence json: nhận; (b) văn bản dẫn "Here is the prediction…" trước và sau JSON: nhận; (c) BOM + CRLF: nhận (tốt hơn kỳ vọng); (d) dấu nháy cong (copy từ Word/Notes/chat rich-text): nút Send khoá, thông báo "The JSON is not valid JSON: Unexpected token…"; (e) dấu phẩy thừa cuối object: khoá, cùng kiểu thông báo.
- Expected: phát hiện (d) và (e) rồi gợi ý "Có dấu nháy cong, bấm để sửa" hoặc chuẩn hoá khi gửi; thông báo nêu dòng/cột và 20 ký tự quanh vị trí lỗi.
- Effort: S.

## Đã kiểm ở vòng 5, hoạt động tốt
- Idempotency khi race: 12 request song song cùng `eventId` và payload = 1 x `201` + 11 x `200 duplicate:true` (không 500, không bản ghi đôi). 8 request song song cùng `eventId`, payload khác nhau = 1 x `201`, 3 x `200`, 4 x `409 EVENT_ID_REUSED`; API Logs ghi đủ `SUCCESS/DUPLICATE/REJECTED`.
- Override/recalculate đồng thời: 6 override khác kết quả + 4 recalculate song song trên cùng pick: toàn bộ `200`, lịch sử `prediction_pick_results` tuần tự đúng, đúng 1 dòng `current` (các dòng cũ có `supersededAt`). (Recalculate khi kết quả không đổi vẫn không ghi dòng, xem UX-034.)
- Validation biên (17 trường hợp): probability ngoài 0..1, odds ≤ 1 hoặc > 1000, line âm cho OU, line > 50 hoặc không phải bội 0,25, `matchMinute` ngoài 0..150, tỉ số ngoài 0..99, correct score ngoài 0..30, ref trùng, rank trùng, picks rỗng, tên đội rỗng/khoảng trắng: đều `400 VALIDATION_ERROR` với `fieldErrors` rõ.
- LIVE `REMAINING_MATCH`: engine đúng (OU 2.5 OVER, tỉ số lúc chụp 1:0, kết quả 2:1 thành `LOSS`; AH -0,25 HOME thành `HALF_LOSS`); thiếu `settlementBasis` cho odds LIVE bị chặn kèm giải thích rõ.
- Lọc ngày gửi cận theo ngày địa phương của trình duyệt (`from=2026-11-29T17:00Z&to=2026-11-30T17:00Z` cho 30/11 ở Asia/Bangkok), Dashboard thêm `tz`; kết quả khớp.
- Đăng nhập: không lộ username (cùng `BAD_CREDENTIALS`, 0,20–0,23 s cho user lạ / user thật / user bị Disable); `returnUrl` chỉ nhận đường dẫn nội bộ.
- Hiệu năng API trên 390 prediction / 144 trận / 1083 dòng log: mọi endpoint đọc 20–37 ms (`size=100` = 86 KB); xuất XLSX hợp lệ (ô số là số).
- Console và network sạch ở cả 9 màn hình (chỉ có 404/400 mong đợi khi mở id không tồn tại, xem UX-071). Toast có `aria-live`, `role=alert/status`.
- Import trong UI: gửi lại đúng JSON hiện "Already stored: this exact JSON was imported before. Open prediction", không tạo bản ghi đôi.
- Giới hạn kích thước: body 1,5 MB bị chặn `400 MALFORMED_REQUEST "Body must be a JSON object (max 1 MB)"` (cả `/external/predictions` lẫn `/predictions/import`); body 0,9 MB `metadata` được nhận, trang chi tiết (1,8 MB JSON vì payload + metadata) vẫn mở sau 121 ms, tab Raw payload có `max-height` 340px nên không phá layout. (Lưu ý nhỏ: payload gốc và metadata đều trả về, tải 1,8 MB cho một prediction.)

## Việc chưa kiểm tra (để vòng sau)
- Build lại stack từ working tree rồi kiểm: dark mode (`prefers-color-scheme` đã có trong `styles.scss` nhưng `shared/chart.ts` đọc một lần lúc tải, biểu đồ không đổi màu khi OS đổi theme giữa phiên), URL state của filter, UX-084 khi UI đã sửa `fmt`.
- `capturedAt` dạng số (chưa chạy; `startTime`, `predictedAt`, `resultAt` đã tái hiện), giới hạn kích thước prompt (`POST /prompts` 3 MB).
- Screen reader thật (NVDA/VoiceOver) cho bảng có dòng mở rộng, tablist và đổi route.
- Hai admin cùng bấm Settle trên giao diện (không qua API) và Override trên CANCELLED/POSTPONED.

---

## Vòng 6 — nhận diện trận, win rate, thời gian, tìm kiếm, theme (UX Reviewer, 2026-11-20)

Góc nhìn: luồng agent thật theo prompt hiện tại (bỏ `eventId`/`externalMatchId`), dữ liệu biên, quyền viewer, theme tối, màn hình ngang, bàn phím/đọc màn hình. Stack chạy `:8088` vẫn cũ hơn working tree; theme tối và cột "Wins incl. half" kiểm trên dev server `:4201` (working tree).

### UX-103 — High — Missing feature / Flow — Không có đường nào đưa kết quả vào cho prediction tự nhận diện
- Prompt "AI Football Prediction Prompt" (v9) dặn: `Leave out "eventId" and "match.externalMatchId": the server finds the match from the team names and the kick-off time`. Server sinh `externalMatchId = auto-<24 hex>` (`PredictionIngestionService.externalIdByTeams`).
- `POST /external/matches/results` và `/predictions/settle` bắt buộc `externalMatchId` (`ResultRequest`, `@NotBlank`). Prompt chỉ yêu cầu agent báo "HTTP status, predictionId và duplicate", không báo `externalMatchId` (doc dòng 158 mới nói dùng id trong response).
- UI không nhập được kết quả (UX-001), UX-067 nói không có template kết quả. Id `auto-…` chỉ nằm ở dòng phụ của Match detail.
- Actual: agent dự đoán không biết id để gửi kết quả; người dùng phải tự chép `auto-622b58f2…` từ Match detail rồi nhờ một agent khác gọi API có key. Trên thực tế trận nằm "Scheduled" mãi, win rate không bao giờ có số.
- Expected (chọn một, tốt nhất cả hai): (a) cho `matches/results` nhận `homeTeam`+`awayTeam`+`startTime` (khớp theo cùng quy tắc `externalIdByTeams`, cửa sổ 12 giờ) khi không có id; (b) bắt prompt báo `externalMatchId` trong dòng kết quả và thêm template "Match result". Gộp với UX-001 (form nhập kết quả cho admin). Đổi contract nên cập nhật `API_DOCUMENTATION.md`, `models.ts`, `docs/samples`.
- Effort: M.

### UX-098 — High — Bug / Data integrity — Các lối còn lại của "hố độc thời gian" (UX-084)
Tái hiện bằng API trên stack đang chạy (`X-Provider: ux-review-r6`):
1. `odds[0].capturedAt = 1796000000000` → `201`. Mở `/predictions/<id>`, tab Odds: console `RangeError: Invalid time value` tại `fmt`, bảng chỉ vẽ 1 trong 4 dòng, cột Captured trống, không có thông báo lỗi. Lỗi chỉ ở trang chi tiết đó, nhưng admin không sửa được qua UI.
2. `match.startTime = "+10000-01-01T00:00:00Z"` (ISO hợp lệ với `Instant`) → `201`; `GET /matches` trả `"+10000-01-01T00:00:00Z"`, `new Date("+10000-…")` ra Invalid (JS cần `+010000-`). Trận này đứng đầu danh sách sắp xếp theo giờ giảm dần nên trang Matches của mọi người thành "0–0 of 0 matches" kèm `RangeError`. Tôi đã sửa dòng đó bằng `UPDATE` (xem "Dữ liệu thử").
3. `startTime = "0001-01-01T00:00:00Z"` → `201` nhưng DB lưu `0001-01-03` (lệch 2 ngày, kiểu chuyển Julian/Gregorian qua `Timestamp.from`): có đường làm sai dữ liệu âm thầm.
4. `startTime = "+999999999-12-31T23:59:59Z"` → `400 INVALID_PARAMETER "Invalid request parameter"` (lỗi DB bị che, không có `fieldErrors`).
- Expected: một cửa sổ hợp lệ chung cho mọi trường thời gian, ví dụ `2000-01-01 .. now + 2 năm` cho `startTime`/`predictedAt`/`resultAt`/`capturedAt`, trả `400 VALIDATION_ERROR` nêu trường và khoảng cho phép; chỉ nhận chuỗi ISO-8601 (chặn số được đọc thành Instant trong Jackson). Phía UI: `fmt` bọc `try/catch` trả "—" để một ô hỏng không làm sập cả bảng (hiện một giá trị xấu = mất cả trang).
- Effort: S.

### UX-097 — Medium — Data integrity / Bug — Nhồi pick để thổi phồng win rate
- Repro: gửi 1 prediction `PRE_MATCH` với 200 odds (trùng market/stage/line nhiều lần) và 20 pick (pick 1 và pick 9 hoàn toàn giống nhau: AH HOME -1 Opening @1.90), rồi gửi kết quả 2:1. API trả `201`. `GET /reports/model-performance`: `r6-model`: `predictions 1`, `picks 20`, `settled 20`, `wins 17`, `winRate 1.0`.
- Ảnh: `backlog-screenshots/UX-097-duplicate-picks.png` (20 pick của một prediction).
- Actual: plan nói "top two picks" và prompt nói rank 1 và 2, nhưng DTO cho tới 20 pick; không khử trùng (market, line, pick, stage); win rate và Dashboard cộng theo pick nên model nào gửi nhiều pick giống nhau sẽ lấn át các model khác, hoặc "chọn cả hai phía" của một line.
- Expected: tối đa 2 pick (hoặc cấu hình), từ chối pick trùng `(oddsRef|market,line,stage,pick)` bằng `400`; thêm cột "win rate theo prediction (top pick)" cạnh win rate theo pick; cảnh báo ở Reports khi `picks/predictions > 2`. Tab Odds 200 dòng cao 8100 px, không có lọc theo market/stage.
- Effort: S đến M.

### UX-099 — Medium — UX / Data — Tìm kiếm phân biệt dấu
- Dữ liệu: "Atlético Madrid – Bayern München", league "Liga Ñandú R6". `GET /matches?search=` (mã hoá UTF-8 đúng): `Atlético`, `ATLÉTICO`, `Ñandú`, `ñandú` ra kết quả; `atletico`, `munchen`, `muenchen`, `munich`, `nandu` ra 0. Filter League khớp chính xác và phân biệt hoa thường (UX-086).
- Người dùng (đặc biệt người Việt, bàn phím không dấu) gõ không dấu là chuyện thường; tên đội/giải bóng đá có dấu rất nhiều (München, Atlético, Beşiktaş, Hà Nội).
- Expected: chuẩn hoá khi tìm: Postgres `unaccent` + `lower` (extension, một migration `V<n>` tạo extension và index trên biểu thức) hoặc cột `*_search` đã chuẩn hoá lúc ghi; áp dụng cho Matches, Predictions, API Logs, filter League.
- Effort: S đến M.

### UX-104 — Medium — Data integrity / Missing feature — Nhận diện trận theo tên đội quá mong manh
- Khi agent bỏ `externalMatchId` (đường chính theo prompt), `externalIdByTeams` so `lower(home)`/`lower(away)` nguyên văn trong cửa sổ 12 giờ.
- Tôi gửi 6 cách viết cùng một trận, cùng provider, cùng giờ: `Atlético Madrid`, `Atletico Madrid`, `Atletico de Madrid` (với `Betis`), `Atlético Madrid FC`, `Atletico  Madrid` (2 dấu cách), `ATLÉTICO MADRID`/`real betis`. Kết quả: 5 trận khác nhau (chỉ biến thể viết hoa khớp). Cùng một agent đọc từ các ảnh chụp khác nhau rất dễ ra những biến thể này, nên "Model comparison", lịch sử prediction của trận và "Predictions = N" bị chia nhỏ.
- Expected: chuẩn hoá khoá (bỏ dấu, gộp khoảng trắng, bỏ dấu câu, bỏ hậu tố `FC/CF/SC`); và (L) công cụ admin "Gộp trận" (chuyển prediction sang trận chính, ghi audit). Liên quan UX-047 (khác provider) và UX-045.
- Effort: M (chuẩn hoá) + L (gộp).

### UX-100 — Low — UX — Màn hình ngang 844x390
- Repro: đặt cửa sổ 844x390, mở `/predictions`. Ảnh: `backlog-screenshots/UX-100-landscape-844x390.png`.
- Actual: topbar 60px dính + panel "Filters" mở sẵn (2 hàng) chiếm gần hết chiều cao; bảng nằm trong khung cuộn riêng (cuộn dọc + cuộn ngang lồng nhau), chỉ thấy 1 dòng dữ liệu. Hàng đầu bắt đầu ở y = 260 trên 390.
- Expected: tự thu gọn Filters khi `max-height: 500px`, bỏ khung cuộn dọc riêng của bảng ở viewport thấp (cuộn theo trang), topbar không dính khi thấp.
- Effort: S.

### UX-101 — Low — UX / A11y — Biểu đồ không đổi theo theme, nhãn trục bị ẩn
- Kiểm trên dev server (working tree): theme tối ổn, quét tương phản chữ 8 màn hình ở theme tối: 0 lỗi dưới 4,5:1. Ảnh: `UX-101-dark-dashboard.png`, `UX-101-dark-charts.png`.
- Đổi `prefers-color-scheme` từ dark sang light khi đang mở Dashboard: thẻ trở trắng nhưng biểu đồ giữ lưới đen và chữ nhạt (`shared/chart.ts` đọc `matchMedia` một lần). Ảnh: `UX-101-theme-switch-charts.png`. Gặp thật khi điện thoại tự đổi sáng/tối theo giờ.
- "Win rate by model" với 14 model chỉ hiện 1 nhãn trục X ("ux-perf 1", Chart.js autoSkip), nên các cột 100% không biết của model nào; không có số mẫu trên cột (liên quan UX-081). Biểu đồ không có bảng thay thế (UX-040).
- Expected: lắng nghe `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', …)` rồi `chart.update()`; với > 8 model dùng thanh ngang có nhãn, hoặc top N + "Others", tooltip kèm số pick.
- Effort: S.

### UX-102 — Low — A11y / UX — Đổi độ rộng cột và thông báo kết quả
- `ResizableColumn` (`shared/kit.ts`): handle `span.col-resizer` rộng 6px, `aria-hidden="true"`, chỉ có `pointerdown`, `touch-action:auto` (trên cảm ứng trình duyệt cuộn thay vì kéo, `pointercancel` kết thúc ngay). Không có cách dùng bàn phím (WCAG 2.1.1) và độ rộng không được nhớ sau khi tải lại. Kéo bằng chuột hoạt động (168 px thành 248 px khi kéo 80 px).
- `mm-paginator` ("1–4 of 4 predictions") và trạng thái đang tải không nằm trong vùng `aria-live`; chỉ có vùng toast `aria-live="polite"`. Người dùng đọc màn hình bấm Apply không nghe thấy kết quả. (Đọc từ DOM, chưa thử với NVDA/VoiceOver.)
- Expected: Left/Right trên handle (`role="separator"`, `aria-orientation`, `tabindex=0`, Shift+mũi tên bước 32px) hoặc ẩn handle trên cảm ứng; `aria-live="polite"` cho dòng đếm; lưu độ rộng vào `localStorage` có try/catch.
- Effort: S.

### UX-108 — Low — Data integrity / UX — Tên model phân biệt hoa thường và dấu câu
- Repro: cùng provider, gửi `X-Model-Name` = `gpt-5.1`, `GPT-5.1`, `gpt-5.1 `, `GPT 5.1`, `gpt-5.1-`: cả 5 `201`. AI Models: 4 model riêng (`gpt-5.1`, `GPT-5.1`, `GPT 5.1`, `gpt-5.1-`); chỉ khoảng trắng cuối được cắt. Tên provider thì được hạ chữ thường (đúng, `UX-Review-R6` gộp vào `ux-review-r6`).
- Actual: prompt dặn "always send the same names", nhưng LLM đổi cách viết là chuyện thường; win rate bị chia nhỏ, không có đổi tên/gộp/archive model (UX-002, UX-017), nên dữ liệu bẩn tồn tại vĩnh viễn trong Reports.
- Expected: khoá model chuẩn hoá (`lower`, gộp `-`/`_`/khoảng trắng) giữ nguyên tên hiển thị của lần đầu; hoặc cảnh báo "giống model X" ở Import; thêm Rename/Merge/Archive cho admin.
- Effort: S (chuẩn hoá) + M (merge).

### UX-105 — Low — UX / Audit — Dời lịch trận
- Repro: gửi prediction cho `r6-pp` (1/12), gửi kết quả `POSTPONED`, rồi gửi prediction mới với `startTime` 8/12. API `201`; Matches hiện `status POSTPONED`, `startTime` 8/12, 2 prediction. Không có lịch sử đổi giờ, không có cách chuyển lại Scheduled (trạng thái chỉ đổi qua `matches/results`), prediction cũ (trước khi dời) vẫn gắn vào cùng trận.
- Mặt khác, trận bị gửi nhầm `CANCELLED` sẽ chặn mọi prediction mới bằng `409 MATCH_ALREADY_FINAL` cho tới khi có kết quả khác; đúng ý, nhưng admin không có nút "mở lại".
- Expected: khi `startTime` đổi, ghi một dòng vào Result history ("Kick-off moved … → …", nguồn); POSTPONED + prediction có giờ mới thì chuyển về Scheduled (hoặc đánh dấu "Rescheduled").
- Effort: S.

### UX-106 — Low — UX / Docs — Idempotency theo chữ, prompt thiếu 409
- Cùng `eventId`: đổi thứ tự khoá, thụt lề, `1.90` thay cho `1.9` = `200 duplicate:true` (tốt). Nhưng `startTime` ghi `…20:00:00.000Z` hoặc `2026-12-21T03:00:00+07:00` (cùng instant) hoặc thừa 1 dấu cách ở tên đội = `409 EVENT_ID_REUSED`. Agent sinh lại JSON khi retry rất dễ ra các khác biệt này.
- Prompt (mục AFTER SENDING) chỉ có 201/200, 400, 401, 429/5xx; không có 409 (`EVENT_ID_REUSED`, `MATCH_ALREADY_FINAL`) hay 413, nên agent không biết dừng hay tạo `eventId` mới. Các sample trong `docs/samples/*.json` đều dùng `eventId`, ngược với prompt.
- Expected: so khớp payload trên dạng chuẩn hoá (Instant, trim); thêm dòng "409: do not retry, report the `code`" vào prompt.
- Effort: S.

### UX-107 — Low — Dev — Proxy `ng serve`
- `proxy.conf.json` dùng context `/api`: Angular dev server (`:4201`) chuyển cả `/api-logs` cho backend, nên F5 ở trang API Logs ra JSON `{"status":401,"code":"UNAUTHORIZED",…}`; nginx dùng `location /api/` nên bản chạy thật (`:8088`) đúng.
- Expected: đổi thành `"/api/"` (hoặc `"^/api/"`).
- Effort: S.

### Đã kiểm ở vòng 6, hoạt động tốt
- Viewer: menu ẩn Import; gõ thẳng `/import` chỉ hiện "Only an admin can import predictions."; trang chi tiết prediction không có nút Recalculate/Override; Settings chỉ có thẻ tài khoản và đổi mật khẩu.
- Đăng xuất rồi bấm Back: chuyển về `/login?returnUrl=%2Fimport`, không hiện lại dữ liệu cũ.
- Mật khẩu: giới hạn 72 byte bcrypt đã được kiểm (`checkBcryptLimit`); username không phân biệt hoa thường; đăng nhập với header `Authorization` cũ/rác vẫn `200`.
- Cache: `index.html` `no-cache` + ETag, `main-*.js` `max-age=31536000, immutable` (hash trong tên file).
- Số liệu nhất quán giữa các màn: tổng pick của `model-performance` (494) bằng `market-performance` (494); 54 win / 57 loss / 379 pending cùng nguồn.
- Enter trong ô Search áp dụng bộ lọc (1 request, `page=0`).
- Idempotency và race với match tự nhận diện: 12 request song song cùng payload không `eventId` = 1 x 201 + 11 x 200 `duplicate:true`, 1 trận, 1 prediction; 8 prediction khác nhau cho cùng cặp đội mới = 8 x 201 trên đúng 1 trận.
- Trạng thái trận: `CANCELLED` ra `VOID`, `POSTPONED` giữ pick Pending, `POSTPONED` rồi `FINISHED 1-0` settle đúng (AH -1 ra PUSH), `FINISHED` rồi `CANCELLED` và `CANCELLED` rồi `FINISHED` đều ra `needsReview` (không tự đổi), khớp thiết kế append-only.
- Trang chi tiết với 200 odds + 20 pick mở trong 91 ms (không ảo hoá, cao 8100 px).
- Dev server (working tree): "Wins incl. half" / "Losses incl. half" đã thay cột Wins/Losses (UX-006); theme tối dùng token nhất quán, không lỗi tương phản.

### Dữ liệu thử
- Provider `ux-review-r6`, model `r6-model`, các trận `r6-*` và `auto-*` (Auto Home/Away, Race Home/Away, Atlético/Betis), user `ux11-viewer` (đã Disable cuối vòng).
- Hai trận độc do tôi tạo (`r6-y10k` năm 10000, `r6-y1` năm 1) và `capturedAt` năm 58882 của prediction `96991c92…` đã được sửa bằng `UPDATE` trong container `matchmind-db-1` để UI dùng chung không bị hỏng. Token và key tạm không được lưu ngoài scratchpad.

## Việc chưa kiểm tra (để vòng sau)
- Build lại stack `:8088` từ working tree rồi kiểm UX-098/UX-103 trên mã mới, endpoint `external/ping` (hiện `404` trên stack cũ), và nút nhập kết quả nếu đã thêm.
- Múi giờ thật (đổi `TZ` của trình duyệt) quanh nửa đêm và DST; NVDA/VoiceOver; iOS Safari thật (zoom khi focus ô < 16px, UX-087).
- Gửi LIVE không có `startTime` vào trận đã có prediction PRE_MATCH (ước lượng giờ đá với nghỉ giữa hiệp 15 phút, không bù giờ).

---

# Vòng 7 (UX Reviewer, Agent 1) — góc nhìn: gửi trùng, múi giờ/locale, bộ lọc ngày, chuỗi dài, vận hành hằng ngày

Phạm vi: bấm đúp nút submit, múi giờ thật (Asia/Ho_Chi_Minh, America/Los_Angeles, Pacific/Kiritimati), locale (vi-VN, de-DE, ar-EG), bộ lọc ngày một đầu hoặc đảo ngược, chuỗi dài, tablet 768px,
quét DOM trợ năng 12 trang, phân trang ổn định, wildcard trong search, user enumeration và timing, header cache, editor prompt quá giới hạn, so plan.md §7/§10/§11/§12 với UI.
Công cụ: script Playwright viết tay (không nhúng thư viện ngoài). Kiểm cả stack `:8088` (cũ hơn working tree) và `ng serve :4201` (working tree); mục nào chỉ đúng một nơi thì có ghi chú.
Dữ liệu thử: provider `ux-review-r7`, model `r7-model` và một model tên 76 ký tự, trận `ux7-*`; user `ux7-dbl`, `ux7-dbl2` đã Disable; prediction `2041c531…` bị override WIN trên trận SCHEDULED (xem UX-065).
Tác dụng phụ: tôi đăng xuất bằng token thứ hai để thử thu hồi phiên (UX-090) nên mọi phiên admin của agent khác bị 401 một lần.

### UX-110 — Medium — UX — Bộ lọc ngày một đầu
- Repro: Matches (hoặc Predictions, Dashboard, Reports): chỉ điền "From" `2026-12-01`, bấm Apply. Request: `from=2026-11-30T17:00Z&to=2026-12-01T17:00Z` (một ngày). Chỉ điền "To" cho đúng kết quả đó.
  Ở Matches, đảo ngược (From 12-31, To 12-01) gửi `from` > `to` và hiện "No matches match these filters." không giải thích. Ba trang dùng filter bar thì có lỗi inline (chữ "before…").
- Expected: "From" một mình nghĩa là từ ngày đó trở đi, "To" một mình là đến hết ngày đó. Nếu cố ý là một ngày thì phải ghi rõ. Matches phải báo `from > to` giống các trang khác.
- Suggested fix: `toFilters()` trong `shared/filter-bar.ts` và `apply()` trong `pages/matches.ts`: bỏ `?? start` / `?? end` (để đầu kia trống), dùng chung một hàm kiểm khoảng ngày. Thêm test.
- Effort: S.

### UX-113 — Medium — Missing feature / Flow — Không có hàng đợi "chờ kết quả"
- Repro: API cho thấy 533 pick, 414 Pending. Ba trận quá 3 giờ sau giờ đá vẫn `LIVE` / `SCHEDULED` (một trận `LIVE` từ 2026-11-19 09:52Z). Dashboard ghi "340 pending" nhưng không phải link; thẻ KPI cũng không bấm được.
  Matches > Status chỉ có Scheduled/Live/Finished/…; không lọc được "đã quá giờ đá, chưa có kết quả", người dùng phải tự đối chiếu giờ.
- Expected: việc hằng ngày là "trận nào đã đá xong mà tôi chưa nhập kết quả". Cần nhãn "Overdue" ở Matches, bộ lọc `overdue=true` (giờ đá + 3 giờ < hiện tại, chưa FINISHED/CANCELLED), và link từ "pending" của Dashboard sang danh sách đó.
- Suggested fix: cờ `overdue` tính ở SQL (tham số tuỳ chọn, không đổi response cũ); link KPI; gộp với UX-001/UX-103 (nút nhập kết quả).
- Effort: M.

### UX-119 — Medium — Missing feature / Docs — Prompt settlement không có đầu vào
- Repro: Prompts > "AI Settlement Calculation Prompt" (v42). Mục "INPUT YOU WILL RECEIVE" cần pick id, odds, line, score lúc chụp và kết quả cuối. Không có nút hay API nào xuất bản đó; người dùng phải chép tay UUID của pick từ Prediction detail.
  Cuối template còn `<!-- e2e mwn2t01l -->` (rác từ E2E); phần "AFTER SENDING" thiếu `422 PICK_NOT_IN_MATCH`; luật 3 không nhắc `FINAL_BELOW_CAPTURE_SCORE` (pick giữ Pending). "UX Test Template" vẫn Active trong danh sách.
- Expected: Match detail có nút "Copy settlement request" tạo sẵn JSON `{externalMatchId, aiCalculations:[{pickId}…]}` kèm kết quả trận; template sạch và khớp `API_DOCUMENTATION.md` mục 3.
- Suggested fix: nút Copy (dữ liệu đã có trong `GET /matches/{id}`); dọn marker bằng migration V<next> hoặc qua UI; thêm các mã lỗi vào template.
- Effort: M (nút), S (dọn template).

### UX-109 — Low — UX — Gửi trùng khi bấm đúp
- Repro: Settings > Add user, điền hợp lệ, nhấn đúp "Add user": `201 POST /users` rồi `409 POST /users`; toast chỉ có "User added", lỗi 409 bị nuốt vì dialog đã đóng. Override một pick (Prediction detail > Override, nhấn đúp "Save override"): hai `POST …/override` cùng `200`, hai toast "Override saved". DB vẫn chỉ 1 dòng kết quả (backend idempotent), nên chỉ là nhiễu.
  Import thì đúng (nút khoá khi gửi, 1 request).
- Suggested fix: signal `busy` trong dialog của kit: `[disabled]="busy()"` ngay khi click, bỏ qua submit thứ hai. Test Playwright `dblclick`.
- Effort: S.

### UX-111 — Low — Bug / UX — Chuỗi dài làm vỡ layout trang chi tiết
- Repro: Import (qua UI) một prediction có `homeTeam` 134 ký tự không dấu cách, `league` 135 ký tự, model 76 ký tự (đều trong giới hạn 160/128). Ở 390px: Dashboard, Matches, Predictions, Models đều 390px; Prediction detail và Match detail rộng 1871px (cuộn ngang cả trang). Ảnh: `docs/backlog-screenshots/UX-111-long-names-mobile.png`.
  Nguyên nhân: chỉ `.dl dd` có `overflow-wrap: anywhere` (`styles.scss:288`); `h2` và dòng `.muted-text` của header card không có.
- Suggested fix: `overflow-wrap: anywhere; min-width: 0` cho tiêu đề card và dòng phụ của trang detail. Test đo `scrollWidth`.
- Effort: S.

### UX-112 — Low — UX / i18n — Locale trộn lẫn
- Repro: `format.ts` dùng `Intl.DateTimeFormat(undefined, …)`, `<html lang="en">`. Trình duyệt vi-VN thấy "predicted 17:00 29 thg 12, 2026" trong câu tiếng Anh; de-DE "29.12.2026, 17:00" (ngày trước tháng, dễ nhầm với en-US); ar-EG chữ số Ả Rập. Số (xác suất `11.0%`, odds `2.40`) luôn dấu chấm. Không có nhãn múi giờ (UX-021).
- Suggested fix: chốt một locale hiển thị (vd `en-GB`, 24 giờ, hoặc cho chọn ở Settings) và thêm "(GMT+7)" ở tooltip hoặc tiêu đề cột thời gian.
- Effort: S.

### UX-114 — Low — UX — Donut Results bị Pending nuốt
- Repro: Dashboard (30 ngày): 340 Pending, 10 Win, 4 Loss… Donut gần như một màu vàng. Ảnh: `docs/backlog-screenshots/UX-114-results-donut-pending.png`.
- Expected: plan.md §7 yêu cầu "Win/Loss distribution". Bỏ Pending khỏi donut (ghi thành chú thích "340 pending") hoặc đặt số đã settle ở giữa.
- Effort: S.

### UX-115 — Low — A11y — Toast
- Code: `kit.ts`: `setTimeout(dismiss, error ? 8000 : 5000)`, không dừng khi hover/focus; `list.slice(-3)` giữ tối đa 4 toast. Lỗi dài (vd 429 kèm thời gian chờ) biến mất trước khi đọc xong; import nhiều làm toast cũ rơi.
- Suggested fix: dừng đếm khi `:hover` / `:focus-within`, toast lỗi không tự tắt, gộp toast cùng nội dung.
- Effort: S.

### UX-116 — Low — UX — Editor prompt không báo giới hạn
- Repro: Prompts > UX Test Template > Edit, dán 250 000 ký tự. Bộ đếm "250000 characters", Save vẫn bật. Save: `400 PUT /prompts/{id}`, toast "Save failed / Request validation failed". API có `@Size(max = 200_000)` cho `content` và 2000 cho `description`.
- Suggested fix: bộ đếm "250,000 / 200,000" (đỏ khi vượt), khoá Save, và toast lấy `fieldErrors.content` (quy tắc repo: "Errors show the API message").
- Effort: S.

### UX-117 — Low — UX — KPI Dashboard không ghi khoảng ngày
- Repro: Dashboard mặc định 30 ngày: Predictions 347, Matches 103, Active models 15 / 48; trang Predictions ghi 438, Matches 174. Chỉ hero có "Win rate for Oct 22 – Nov 20". Thẻ không phải link tới danh sách đã lọc.
- Suggested fix: dòng phụ "30 ngày qua" dưới số; bấm thẻ mở trang tương ứng với cùng bộ lọc (gộp với UX-113).
- Effort: S.

### UX-118 — Low — Data integrity — Quy tắc tên provider khác model
- Repro: `POST /predictions/import?provider=ux-review-r7`, rồi `UX-Review-R7` và ` ux-review-r7 `: cả ba `201`, chung một provider (2 model, 5 prediction). Dấu gạch nối Unicode `‐` bị `400 INVALID_PROVIDER` (đúng). Tên model thì phân biệt hoa thường (UX-108).
- Suggested fix: áp cùng quy tắc chuẩn hoá (trim, so khớp không phân biệt hoa thường, `UNIQUE (provider_id, lower(name), version)`) cho model, hiển thị tên gốc của lần đầu. Cần migration mới nếu gộp dữ liệu cũ.
- Effort: S–M.

## Đã kiểm ở vòng 7, hoạt động tốt
- Tablet 768x1024: không cuộn ngang ở 9 màn hình; sidebar thu thành nút menu.
- Múi giờ: lọc ngày theo ngày địa phương đúng ở Asia/Ho_Chi_Minh, America/Los_Angeles, Pacific/Kiritimati (trận `2026-12-30T19:00Z` hiện ngày 31 ở VN, ngày 30 ở LA; lọc cả hai ngày đúng). Dashboard gửi `tz=`, "Today" tính theo múi giờ người xem.
- Phân trang ổn định: duyệt hết 434 prediction với 6 khoá sort và 172 trận với 3 khoá sort, không trùng, không sót.
- Search `%`, `_`, `\`, `a%b` ở Matches, Predictions, API Logs đều được escape (không có wildcard injection); filter League `%` / `_` cũng vậy.
- Login: username không phân biệt hoa thường và được cắt khoảng trắng; bộ đếm khoá gộp mọi biến thể chữ hoa; thời gian phản hồi như nhau cho user có và không tồn tại (~204 ms); `returnUrl` ngoài app bị chặn.
- API có `Cache-Control: no-store` cho mọi endpoint đã xác thực, kể cả CSV export. Preflight CORS từ origin lạ trả 403. `SELF_LOCKOUT` chặn tự hạ quyền hoặc tự Disable.
- Dialog: Tab bị giữ trong dialog, đóng xong focus trả về nút đã mở.
- DOM 12 trang (working tree): 0 nút/link không tên, 0 input không nhãn, 0 id trùng, 0 `tabindex` dương.
- Hiệu năng: mọi endpoint đọc 6–80 ms với 438 prediction; `size=100` trả 60–85 KB; DOMContentLoaded 366 ms, load 595 ms.
- Tĩnh: `robots.txt` có, `meta robots noindex`, không có source map (`main-*.js.map` trả SPA HTML), `/.env` và `/.git/config` chỉ trả SPA HTML.
- Prompt settlement tồn tại (plan.md §11 mẫu 2). Import bấm đúp an toàn.

## Việc chưa kiểm tra (để vòng sau)
- Build lại stack `:8088` từ working tree rồi kiểm lại UX-098, UX-103 và UX-010 trên bản dựng thật; `ng serve :4201` không proxy `/api-logs` (UX-107) nên API Logs chưa kiểm trên working tree.
- Tab để mở lâu sau khi phiên bị thu hồi ở nơi khác: giao diện vẫn trông như đang đăng nhập, SSE không đóng, chỉ lộ ra ở lần bấm kế tiếp (gần UX-064/UX-090); chưa đo thời gian.
- NVDA/VoiceOver thật, iOS Safari thật (zoom ô < 16px, `autocapitalize` ô username), in ấn (không có `@media print`, không có `forced-colors`).
- Axe-core chưa chạy (không nhúng thư viện tải từ CDN); mới có quét DOM thủ công.

## Vòng 8 — dialog, nén, header, focus, phiên (UX Reviewer, 2026-11-20)
Góc nhìn: bàn phím và trợ năng thật trên stack `:8088`, header HTTP, đo kích thước truyền, tính năng so với plan.md §12–13. Mã nguồn không đổi.

### UX-120 — Medium — Bug / A11y — Esc không đóng dialog
- Repro: Settings > "Add user" (hoặc API Logs, bấm một dòng). Bấm Esc. Sự kiện `cancel` chạy nhưng dialog vẫn mở; Esc lần 2 mới đóng (API Logs), còn "Add user" sau 2 lần Esc vẫn mở. Cùng thao tác trên `<dialog>` thuần: đóng ngay ở lần 1.
- Nguyên nhân (đã xác minh ở `matchmind-web/src/app/shared/kit.ts`, dòng `<dialog ... (cancel)="!closable() && $event.preventDefault()">`): khi `closable()` là `true` biểu thức là `false && ...` = `false`; Angular coi giá trị trả về `false` của listener là yêu cầu `preventDefault()`, nên Esc luôn bị huỷ. Comment "Chrome closes a modal on a second Esc" trong `onNativeClose()` là dấu vết của chính lỗi này.
- Expected: Esc đóng dialog (APG dialog, WCAG 2.1.2/2.1.1); dialog không-đóng-được mới chặn Esc.
- Suggested fix: đổi thành `(cancel)="closable() || $event.preventDefault()"` (trả `true` thì không chặn). Thêm một spec: mở dialog, phát `cancel`, kỳ vọng `closed` được emit. Ảnh hưởng cả Confirm, Override, Add user, API call.
- Effort: S.

### UX-121 — Medium — Perf — Không nén HTTP
- Repro: `curl -s -H "Accept-Encoding: gzip,br" -o /dev/null -w "%{size_download}" http://localhost:8088/main-<hash>.js` ra 295 044 (không có `Content-Encoding`); `GET /api/v1/predictions?size=100` ra 87 137 B. `grep -n gzip matchmind-web/nginx.conf` không có kết quả.
- Expected: JS/CSS/JSON/SVG được nén (JS ~80 KB, JSON ~10 KB), đặc biệt khi dùng qua điện thoại.
- Suggested fix: `gzip on; gzip_types application/javascript text/css application/json image/svg+xml; gzip_min_length 1024; gzip_vary on;` ở `server` của web nginx (proxy `/api` cùng block). Không đụng SSE (`text/event-stream` không nằm trong `gzip_types`, và giữ `proxy_buffering off`).
- Effort: S.

### UX-122 — Low — Security / Ops — Header bảo mật lặp
- Repro: `curl -sI -H "Authorization: Bearer <token>" http://localhost:8088/api/v1/matches?size=1`: có hai `Content-Security-Policy`, hai `X-Frame-Options: DENY`, hai `X-Content-Type-Options: nosniff`. Trình duyệt áp dụng giao của hai CSP nên chưa hỏng gì, nhưng cấu hình sẽ lệch dần.
- Suggested fix: để nginx `proxy_hide_header` các header đó từ upstream cho `/api`, hoặc chỉ thêm ở một tầng. Thêm `Strict-Transport-Security` khi chạy sau HTTPS ở production.
- Effort: S.

### UX-123 — Low — A11y — Không báo đổi trang
- Repro: Matches, bấm link "Predictions" ở sidebar. `document.title` đổi nhưng `document.activeElement` vẫn là link sidebar; không có vùng `aria-live` nào báo tên trang mới (vùng live duy nhất là toast). Người dùng screen reader không biết trang đã đổi.
- Suggested fix: sau `NavigationEnd`, focus `<h1>` (`tabindex="-1"`) hoặc `main`, hoặc dùng `Title` + `LiveAnnouncer` của CDK (không muốn thêm thư viện thì một `<div class="sr-only" aria-live="polite">` ghi tiêu đề trang). Bỏ qua khi chỉ đổi query string.
- Effort: S.

### UX-124 — Low — UX / Data loss — Hết phiên đột ngột
- Repro: đăng nhập, đọc `exp - iat` trong JWT = 28 800 s (8 giờ), `AuthService` đặt `setTimeout` đến đúng `expiresAt` rồi `navigate('/login?expired=1')`. Không có renew, không có banner "phiên sắp hết", không có `returnUrl` cho trạng thái đang sửa (xem UX-035, UX-048).
- Expected: người đang dùng liên tục không bị đá ra; hoặc có cảnh báo 5 phút trước và nút "Giữ phiên".
- Suggested fix: sliding expiry (endpoint refresh dùng token còn hạn, đổi contract) hoặc banner cảnh báo + nút gia hạn; tối thiểu giữ bản nháp Prompt/Import trong `sessionStorage` rồi khôi phục sau khi đăng nhập lại.
- Effort: M (đổi contract nếu thêm refresh).

### UX-125 — Low — A11y — Tabs thiếu Home/End
- Repro: Reports, focus tab đầu, bấm End: tab đang chọn vẫn là "Prediction history" (xem `Tabs.key()` trong `shared/kit.ts`, chỉ xử lý `ArrowRight`/`ArrowLeft`). Mũi tên đổi tab và gọi API luôn, không cần Enter.
- Suggested fix: thêm `Home`/`End` (và `preventDefault` để trang không cuộn). Giữ nguyên activation tự động nếu báo cáo tải nhanh, hoặc đổi sang manual activation cho tab nặng như Monte Carlo.
- Effort: S.

## Đã kiểm ở vòng 8, hoạt động tốt
- Reports: `?tab=` nằm trên URL, reload giữ đúng tab; `aria-selected`, roving `tabindex` đúng.
- Mỗi route có `<title>` riêng, `lang="en"`, đúng một `<h1>`, có `<main>`, skip-link, không cuộn ngang cấp trang ở 10 route desktop.
- API Logs có chi tiết một request (dialog, mở bằng Enter trên dòng vì `tr tabindex=0`), đáp ứng plan.md §13 "Request detail view"; ở 390px dialog không tràn, `pre` cuộn ngang trong khung.
- Prompt dùng khoá lạc quan `expectedVersion` (`PROMPT_VERSION_CONFLICT`), không mất bản sửa khi hai admin lưu cùng lúc.
- `/` và static: `X-Frame-Options: DENY`, `nosniff`, CSP chặt, `Cache-Control: immutable` cho file băm, `no-cache` cho `index.html`.
- JWT ở `sessionStorage` (không cookie), phát `tv` (token version) để thu hồi; không có `innerHTML` trong `src`.

## Việc chưa kiểm tra (để vòng sau)
- Sau khi sửa UX-120, kiểm lại Esc trên Confirm/Override/Add user/Reset password và focus trả về nút đã mở.
- Đo kích thước thật sau khi bật gzip (UX-121) và xác nhận SSE vẫn chạy.
- Chưa dựng được trạng thái "sổ trống" (không xoá dữ liệu thật); cần DB riêng để kiểm onboarding lần đầu.


---

# Trạng thái triển khai (Dev lanes, 2026-11-20, nhánh `matchmind/backlog`)

Làm song song theo 9 lane (API: A ingestion, B security/ops, C results/settle/prompts, E read side; Web: W1 shell/kit/a11y,
W2 list, W3 detail, W4 dashboard/reports, W5 import/prompts/settings/session) cộng 1 lane design (D) và 1 lượt tích hợp.
Verify: API `mvn -B clean verify` 89 unit + 100 IT xanh; Web `ng test` 210/210 + `ng build` xanh. Chưa QA trên trình duyệt
thật (không chạy dev server/Playwright). Migration mới: V14–V22.

## Đã sửa
001 003 004 005 006 007 008 009 010 011 013 015 016 017 020 021 022 023 024 025 026 028 029 030 031 032 033 034 035 036
037 038 039 040 042 043 044 045 046(tín hiệu `possibleDuplicateOf`) 048 049 050 051 052 053 055 056 057 058 059 060 062
063 064 065 066 067 068 069 070 071 072 073 074 075 076 077 078 079 080 081 082 083 084 085 087 089 090 091 092 093 094
095 096 097 098 101 102 103 105 106 107 109 110 111 112 113 114 115 116 117 119 120 121 122 123 124 125

## Đã đúng từ trước (chỉ thêm test)
012 014 054 (CORS preflight; thêm expose headers)

## Làm một phần
- UX-041, UX-100: chỉ sửa CSS, chưa đo ở 320px / điện thoại ngang trên trình duyệt.
- UX-086: lọc league bỏ hoa thường/dấu/khoảng trắng; chưa có alias/gộp tên giải.
- UX-099: tìm kiếm bỏ dấu ở matches/predictions/dashboard/reports; ô search của API Logs chưa.
- UX-104: chuẩn hoá tên đội khi tự nhận diện trận; công cụ gộp trận → plan.
- UX-108, UX-118: tên model/provider khớp không phân biệt hoa thường; tên hiển thị provider vẫn là code viết thường; rename/gộp → plan.

## Chỉ có plan, chờ quyết định của owner (`docs/plans/2026-11-20-*.md`)
- UX-027 + UX-061 + UX-019: API key theo provider, màn Providers → `per-provider-api-keys.md`
- UX-047 + UX-104 (gộp): định danh trận xuyên provider → `cross-provider-match-identity.md`
- UX-088: trigger/role DB cho bất biến, append-only → `db-level-integrity.md`
- UX-018: ROI/units, cảnh báo mẫu nhỏ, calibration → `roi-units-calibration.md`
- UX-002 + UX-108 (gộp): archive, rename, merge, dữ liệu E2E → `archive-rename-merge-hygiene.md`
- UX-046 (cách tính report): đếm prediction trùng → `duplicate-prediction-counting.md`

## Thay đổi hành vi cần biết khi deploy
- `POST /auth/logout` chỉ đăng xuất phiên hiện tại; `POST /auth/logout-all` đăng xuất mọi nơi. Token có `jti`, bảng `revoked_tokens`.
- nginx không còn tin `X-Forwarded-For` của client; sau reverse proxy TLS phải mount `/etc/nginx/real-ip.d/*.conf` (README).
- Đặt `PUBLIC_BASE_URL` ở prod: prompt dùng `{{API_BASE_URL}}`, nếu thiếu sẽ lấy từ `Host`/`X-Forwarded-Proto` của request.
- Env mới: `JWT_MAX_SESSION` (24h), `EXTERNAL_MAX_REJECTED_PER_IP` (30); `LOGIN_MAX_ATTEMPTS_PER_IP` 20 → 30.
- Agent API: tối đa 2 pick; thời gian phải ISO-8601 có offset; `predictedAt`/`capturedAt` ≤ now + 5 phút; `resultAt` ≤ now + 5 phút.
- `/api-logs` và `/import` chỉ cho ADMIN. User bị đặt `mustChangePassword` chỉ vào được Settings cho tới khi đổi mật khẩu.
