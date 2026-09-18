# Kira Life Mobile · Glacier

Ứng dụng React Native / TypeScript dùng Expo Router, năm tab **Thẻ tín dụng · Đầu tư · Du lịch · Sức khỏe · Cá nhân**,
đăng nhập thật vào `kira-bank-service`, nhập ảnh giao dịch, AI queue, thống kê, theo dõi sức khỏe, lập kế hoạch du lịch
và cài đặt cá nhân. Giao diện vẫn giữ các kịch bản demo cho QA ở route `/demo`.

## Cài đặt và mở bằng Expo Go

```powershell
cd D:\kira\kira-app\kira-bank\kira-life-mobile
npm ci
npm start
```

Máy tính và điện thoại dùng cùng mạng Wi-Fi. Mở Expo Go trên Android hoặc dùng Camera iPhone quét QR trong terminal rồi
chọn mở bằng Expo Go. Cho phép kết nối mạng nội bộ khi thiết bị hỏi. Giữ terminal đang chạy; nhấn Ctrl+C để dừng. Nếu
máy có tường lửa, cho phép Node trên mạng riêng.

Ứng dụng hiện dùng Expo SDK 57 theo `package.json`. Expo Go trên thiết bị phải tương thích với SDK này; khi gặp thông
báo không tương thích, đối chiếu [hướng dẫn Expo](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) trước
khi nâng SDK.

## Kết nối backend

Thống kê dòng tiền theo ngày dùng `INVESTMENT_IMPORT_TIME_ZONE` của backend (mặc định `Asia/Ho_Chi_Minh`) để bộ lọc và
gom nhóm theo ngày nhất quán.

Tạo `.env` từ `.env.example` và đặt `EXPO_PUBLIC_API_URL` trỏ đến `kira-bank-service`:

- iOS Simulator: `http://localhost:8080`
- Android Emulator: `http://10.0.2.2:8080`
- Thiết bị thật: địa chỉ LAN của máy chạy service, ví dụ `http://192.168.1.192:8080`

Luồng Investment hỗ trợ chụp trực tiếp hoặc chọn tối đa 10 ảnh/lô, ảnh được backend lưu trên Cloudflare R2; AI xử lý bất
đồng bộ qua Cloudflare Workers AI. Người dùng theo dõi queue, xem ảnh/kết quả chuẩn hóa, chỉnh sửa và xác nhận thủ công
trước khi giao dịch được ghi vào sổ đối soát. Khi ảnh lỗi hoặc AI không nhận diện được, màn **Nhập giao dịch thủ công**
cho phép ghi nhận trực tiếp với cùng kiểm tra ownership, currency và chống trùng. Dashboard Investment có bộ lọc 7/30/90
ngày và thống kê trực tiếp từ service cho ba loại Deposit, Withdrawal và Bonus theo từng currency; giá trị ròng tính cả
Bonus và dữ liệu daily cũng tách đủ ba loại.

Transaction detail có luồng **Báo cáo sai lệch** thật: người dùng chọn lý do, mô tả tối thiểu 10 ký tự và tạo hồ sơ tra
soát riêng, không sửa transaction. Màn **Hồ sơ tra soát** tải đủ danh sách, lọc
OPEN/IN_REVIEW/NEEDS_INFO/RESOLVED/REJECTED và xem chi tiết; backend kiểm tra ownership, chống mở trùng hồ sơ đang mở và
dùng version lock cho thao tác Admin. Hồ sơ được lưu bằng migration V28.

Mỗi hồ sơ có lịch sử trạng thái append-only từ lúc tạo đến các lần Admin chuyển trạng thái hoặc bổ sung kết luận;
migration V29 lưu các sự kiện này riêng, giúp màn chi tiết hiển thị tiến trình đầy đủ mà không ghi đè lịch sử.

Người dùng có role ADMIN có thêm màn **Quản trị tra soát** trong trang Cá nhân để xem toàn bộ hồ sơ, lọc theo trạng
thái, tải thêm theo trang và cập nhật trạng thái/ghi chú. Thao tác dùng version hiện tại, nhận lại lịch sử mới nhất và
gửi thông báo cho người tạo hồ sơ.

Admin cũng có màn **Cloudflare & R2** để quản lý account provider: credential chỉ nhập dạng secret và response luôn
masked; có thể Test AI/R2, bật/tắt Workers AI, chọn hoặc dừng R2 primary, gán attachment legacy và xóa account chỉ khi
không còn file. `AI_MODEL` trong env vẫn được ưu tiên toàn cục.

Admin có thêm màn **Queue AI toàn hệ thống** để lọc và theo dõi attachment của tất cả người dùng, xem tổng quan số lượng
theo trạng thái, owner/model/số lần chạy/lô chờ duyệt/kết quả chuẩn hóa, chạy lại job lỗi hoặc hủy job đang chờ. Màn này
tự polling khi còn job PENDING/PROCESSING; Admin chỉ điều khiển pipeline, người dùng vẫn là người kiểm tra và xác nhận
transaction. Mỗi job có màn chi tiết với lịch sử chuyển trạng thái append-only (migration V30), actor USER/ADMIN/SYSTEM,
lần thử và reason code an toàn; danh sách queue chỉ tải lịch sử khi mở chi tiết.

Compose local và Hub truyền `AI_MODEL` vào service để thay model qua môi trường; Trung tâm thông báo tải đủ lịch sử và
giữ tham số deep-link khi mở đúng sao kê, chứng từ hoặc lô AI.

Thông tin tài khoản đầu tư không trả mật khẩu về mobile/API response. Mật khẩu được mã hóa AES-GCM ở backend; cần cấu
hình `INVESTMENT_CREDENTIAL_ENCRYPTION_KEY` bằng khóa Base64 32 byte và chạy migration V26. Bản ghi cũ dạng rõ sẽ được
chuyển sang mã hóa khi được đọc nếu khóa đã cấu hình. Khi chỉnh sửa, ô mật khẩu để trống sẽ giữ mật khẩu hiện tại; chỉ
giá trị người dùng chủ động nhập mới được gửi lên. Lịch sử đầu tư có thể chia sẻ dạng CSV theo đúng bộ lọc hiện tại, gồm
giá trị âm chuẩn hóa cho Withdrawal.

Dashboard Thẻ tín dụng lấy thống kê thật theo cấp ngân hàng: tổng hạn mức, dư nợ sao kê, dư nợ hiện tại, khả dụng, tỷ lệ
sử dụng, xu hướng 3/6/12 tháng và chi tiết từng thẻ. Màn **Quản lý thẻ** hỗ trợ thêm/sửa/thay đổi trạng thái bằng API;
màn thống kê cho phép điều chỉnh số dư ngân hàng với lý do bắt buộc và version conflict, đồng thời chia sẻ bảng tổng hợp
CSV theo ngân hàng đang lọc.

Trang **Cá nhân** tải identity từ session thật, lưu màu sắc/ngôn ngữ/thông báo/quyền thiết bị trên máy và có màn **Chỉnh
sửa hồ sơ** gọi API thật cho họ tên, số điện thoại, đổi mật khẩu; cập nhật profile dùng version conflict.

Màn **Quản lý sao kê** cho phép nhập kỳ sao kê, lọc trạng thái và ghi nhận thanh toán; màn **Lịch sử thanh toán** hiển
thị riêng từng khoản đã ghi nhận, phương thức, mã tham chiếu và số dư còn lại của kỳ sao kê. Hai màn quản lý tải đủ các
trang sao kê, thanh toán và thẻ để không mất lịch sử khi dữ liệu vượt 50 dòng. Backend trả DTO lịch sử giới hạn trường
nghiệp vụ cần thiết, không trả khóa idempotency hoặc metadata nội bộ.

Từ **Quản lý thẻ**, người dùng có thể mở từng thẻ để cập nhật kỳ sao kê hiện tại: dư nợ, thanh toán tối thiểu và trạng
thái chưa thanh toán/đã thanh toán. API dùng billing version và không cho sửa kỳ đã có thanh toán.

Màn **Ưu đãi & hoàn tiền** quản lý theo từng thẻ qua API thật: trần hoàn tiền tháng, chương trình bật/tắt, nhóm danh
mục, tỷ lệ, trần từng nhóm và nhiều mã MCC. Cập nhật chương trình dùng version conflict; xóa là soft-delete.

Biểu tượng chuông mở **Trung tâm thông báo** thật từ backend, có số chưa đọc, lọc chưa đọc, đánh dấu đã đọc và mở liên
kết nội bộ đến sao kê hoặc hàng đợi AI; số chưa đọc tự làm mới mỗi 30 giây khi app đang mở. Scheduler sao kê tự tạo
reminder chống trùng khi cần nhập số liệu, sắp đến hạn hoặc đã quá hạn; AI tạo thông báo riêng theo chứng từ khi READY
hoặc FAILED cuối cùng, và deep-link FAILED đưa chứng từ liên quan lên đầu queue. Dedup notification có index migration
V27; tên file hiển thị được giới hạn độ dài, không đưa raw AI response hay credential vào notification.

Module **Du lịch** dùng API thật `/api/v1/travel/trips`. Mỗi kế hoạch có tên/điểm đến/ngày/ngân sách và các danh sách đồ
cần mua, việc cần chuẩn bị, địa điểm sẽ đến, lịch trình và checklist. Các mục có thể thêm, xóa, đánh dấu đã mua/đã hoàn
tất/đã ghé thăm và lưu bằng optimistic locking. Khi chuyến đi đã được tạo, người dùng có thể tải tối đa 20 tài liệu
PDF/PNG/JPEG riêng tư, xem ảnh trực tiếp và xóa tài liệu theo quyền chuyến đi.

Module **Sức khỏe** dùng API thật `/api/v1/health`: hồ sơ người trưởng thành, BMI, mục tiêu năng lượng, cân nặng theo
ngày, thống kê 7 ngày, nhật ký bữa ăn/tập luyện, kế hoạch tuần và lịch sử tạo kế hoạch AI. Kế hoạch nháp phải được người
dùng kiểm tra hạn chế rồi kích hoạt; kế hoạch đang hoạt động dùng version lock khi đánh dấu hoàn tất. Backend đã có
ownership, giới hạn ngày, kiểm tra dị ứng/thực phẩm tránh/hạn chế vận động và revision sync cho Apple Health. Expo hiện
hiển thị rõ trạng thái native bridge; chỉ thiết bị đã được native HealthKit/Health Connect cấp quyền mới được đồng bộ,
không tạo kết nối giả từ UI.

**Password Vault** được mở từ trang Cá nhân. Người dùng mở khóa bằng mật khẩu đăng nhập hiện tại; backend trả unlock
token ngắn hạn, mobile chỉ giữ token trong bộ nhớ màn hình và tự khóa sau 5 phút/rời màn hình. Danh sách nhóm/tài khoản
chỉ trả dữ liệu đã che, còn reveal/update secret đi qua header unlock và được audit; secret không được ghi vào
AsyncStorage hay session.

Module **Lịch dạy gia sư** được mở từ trang Cá nhân qua `/api/v1/tutoring`: hiển thị lịch theo tuần, tổng số
buổi/giờ/học phí, cảnh báo trùng giờ, danh bạ học viên, lịch lặp, chỉnh riêng một buổi, hủy/khôi phục và kết thúc lịch
từ tuần đang xem. Tuần quá khứ là read-only; thay đổi học viên/lịch dùng version lock và lịch bị trùng phải có thao tác
xác nhận riêng.

Module **Chỗ ở & Tin trọ** được mở từ trang Cá nhân qua `/api/v1/lodgings`: tìm kiếm và phân trang tin trọ,
thêm/sửa/xóa, chi phí điện/nước/dịch vụ/giữ xe, tối đa 10 ảnh riêng tư trên R2, gợi ý địa chỉ Mapbox, địa điểm tham
chiếu, tính lại khoảng cách, đánh giá OK/Không OK và version lock. Khi Mapbox chưa cấu hình, địa chỉ vẫn được lưu và
trạng thái định vị hiển thị rõ để người dùng thử lại sau.

Xem trước trên trình duyệt: `npm run web`. Đây là bản render React Native Web, không thay thế kiểm tra Expo Go trên điện
thoại.

## Đối chiếu mockup (bản cập nhật giao diện)

Các màn tiếp tục dùng các route trong `SCREEN-MAP.md`. Header Kira Bank, tab dưới, thẻ kính, ảnh minh họa gốc, biểu đồ
SVG native và các bảng sửa/tra soát đã được bổ sung. Hai bộ lọc nâng cao/toàn trang không nằm trong phạm vi.

Mở `/demo` trên Expo Web để chọn dữ liệu kiểm tra. Công cụ này đã tách khỏi màn Cá nhân. Các kịch bản `Mockup` cung cấp
dữ liệu lịch sử, kết quả xác nhận và thống kê riêng; chúng không phải số dư ngân hàng thật. Chọn kịch bản cần xác nhận
vì sẽ thay dữ liệu demo hiện tại.

- `assets/reference/`: 11 ảnh minh họa lấy từ từng thẻ/ảnh trong HTML mẫu; `sources.json` ghi nguồn. Không sử dụng ảnh
  chụp nguyên màn làm giao diện.
- `src/charts.tsx`: biểu đồ native bằng `react-native-svg`, tương thích Expo SDK 54.
- Bộ lọc hỗ trợ nhiều loại giao dịch, trạng thái, khoảng tiền và tối đa 90 ngày (bao gồm cả hai đầu). Các mốc nhanh dùng
  ngày demo 18/10/2024.
- Khóa AsyncStorage vẫn là `kira-life-demo-v1`; bộ lọc cũ được nâng sang danh sách loại khi nạp. Điều chỉnh hạn mức/số
  dư và lịch sử lý do lưu trong `creditConfig` tại thiết bị.
- Các phản hồi mô phỏng chỉ còn ở công cụ QA `/demo`; các màn thẻ, sao kê, thanh toán, ưu đãi và số dư chính dùng API
  thật.

## Thử các luồng

1. **Đầu tư → Nhập giao dịch:** chọn tài khoản đang hoạt động, chọn 1–10 ảnh, tạo lô rồi chờ AI xử lý. Kiểm tra từng bản
   ghi, sửa loại/số tiền/thời gian, chọn cách xử lý trùng lặp và xác nhận thủ công. Nếu không có ảnh hoặc ảnh không đọc
   được, dùng **Nhập giao dịch thủ công**; bản ghi xuất hiện trong lịch sử sau khi API xác nhận thành công.
2. **Hàng đợi AI:** theo dõi PENDING/PROCESSING/READY/FAILED/CANCELLED/CONFIRMED, lọc theo trạng thái/account, xem số
   bản ghi chờ duyệt, mở ảnh R2, xem JSON chuẩn hóa, mở **Chi tiết** để xem timeline lifecycle, chạy lại job lỗi hoặc
   hủy job đang chờ. Queue tự polling khi có job đang chạy; notification READY mở thẳng kết quả, notification FAILED mở
   queue và ưu tiên đúng chứng từ.
3. **Chứng từ giao dịch:** ảnh được kiểm tra MIME/nội dung ở backend, lưu trên R2 và gửi Cloudflare Workers AI theo
   batch scheduler hoặc thao tác chạy thủ công. Model runtime lấy từ `AI_MODEL` nếu được cấu hình, nếu không dùng model
   của Cloudflare account đã xác minh.
4. **Lịch sử → Bộ lọc:** dữ liệu lấy từ service, tải đủ các trang tài khoản/giao dịch, có lọc
   account/status/type/date/amount và tìm kiếm cục bộ. Thẻ thống kê cộng đúng các tài khoản cùng currency và luôn hiển
   thị riêng Deposit, Withdrawal và Bonus. Thống kê theo từng tài khoản có khoảng toàn thời gian, 30, 90 hoặc 365 ngày
   và dòng tiền theo ngày.
5. **Chi tiết → Báo cáo sai lệch:** nhập ít nhất 10 ký tự, gửi rồi mở danh sách báo cáo. Giao dịch gốc giữ nguyên. Hồ sơ
   mới sẽ ở trạng thái **Mở**; khi Admin xử lý, người dùng theo dõi kết quả và resolution note tại màn chi tiết. Nếu
   transaction đã có hồ sơ đang mở, màn chi tiết chỉ cho mở hồ sơ hiện có.
6. **Tài khoản → Thêm / Chỉnh sửa:** sửa tên, trạng thái, thông tin account đầu tư; backend kiểm tra ownership/version.
   Tiền tệ cố định sau khi tạo. Không nhập mật khẩu hoặc thông tin đăng nhập thật vào môi trường dùng chung.
7. **Route `/demo`:** chọn kịch bản mặc định, thành công toàn bộ, lịch sử trống, AI chờ/đang xử lý/thất bại. Có xác nhận
   trước khi thay thế dữ liệu. Mục **Đặt lại dữ liệu mẫu** khôi phục dữ liệu ban đầu.
8. Đóng/mở lại app để kiểm tra session, ngôn ngữ, màu sắc, sinh trắc học, khóa khi vào nền, thông báo, liên kết VietQR
   và dữ liệu demo được giữ đúng phạm vi lưu trữ. Session thật nằm trong SecureStore trên native; các preference giao
   diện nằm trong AsyncStorage. Mục quyền thiết bị mở cài đặt hệ điều hành và mục Camera/Ảnh xin quyền thư viện ảnh.
9. **Du lịch:** mở tab Du lịch, tạo kế hoạch, thêm thành viên, hành lý, đồ cần mua, việc chuẩn bị, địa điểm, lịch trình,
   chi phí, booking và checklist; kiểm tra bảng quyết toán rồi lưu. Mở lại kế hoạch để kiểm tra dữ liệu được tải từ
   backend.
10. **Thẻ → Quản lý sao kê:** nhập sao kê theo thẻ, lọc theo trạng thái và ghi nhận thanh toán với mã tham chiếu. API
    thanh toán dùng Idempotency-Key; ứng dụng không tự động chuyển tiền.
11. **Thẻ → Lịch sử thanh toán:** mở từ màn Quản lý sao kê để tra cứu các khoản thanh toán theo tài khoản hiện tại và
    quay lại đúng kỳ sao kê.
12. **Thẻ → Ưu đãi & hoàn tiền:** chọn thẻ, cập nhật trần tháng, tạo/sửa chương trình, bật/tắt chương trình và nhập
    nhiều MCC cho từng nhóm.
13. **Thẻ → Thống kê ngân hàng → Điều chỉnh số dư:** nhập lý do bắt buộc, sau đó mở lịch sử để xem từng phiên bản điều
    chỉnh bất biến.
14. **Chuông thông báo:** mở danh sách cảnh báo, lọc mục chưa đọc, chạm để đánh dấu đã đọc và đi tới màn hình liên quan.
15. **Thẻ → Cập nhật kỳ sao kê:** mở từ một thẻ, nhập dư nợ và thanh toán tối thiểu, chọn trạng thái rồi lưu; nếu dữ
    liệu đã đổi ở nơi khác, tải lại thẻ trước khi lưu.
16. **Cá nhân → Chỉnh sửa hồ sơ:** cập nhật họ tên/số điện thoại; đổi mật khẩu yêu cầu mật khẩu hiện tại, mật khẩu mới
    tối thiểu 8 ký tự và xác nhận trùng khớp.
17. **Cá nhân (Admin) → Quản lý hồ sơ tra soát:** lọc danh sách, mở form cập nhật từng hồ sơ, chọn trạng thái mới, ghi
    resolution note và lưu; kiểm tra lịch sử bất biến sau khi cập nhật.
18. **Cá nhân (Admin) → Cloudflare & R2:** tạo/sửa provider bằng credential mới hoặc để trống để giữ secret, Test AI/R2,
    bật AI sau khi verify, chọn R2 primary và xử lý file legacy.
19. **Cá nhân (Admin) → Queue AI toàn hệ thống:** xem tổng quan aggregate theo trạng thái, lọc theo trạng thái, tải thêm
    theo trang, theo dõi processing tự động, mở chi tiết timeline, chạy lại hoặc hủy attachment AI theo quyền Admin.
20. **Cá nhân → Password Vault:** mở khóa bằng mật khẩu hiện tại, tạo/sửa/xóa nhóm, tạo/sửa/xóa tài khoản, reveal và
    copy dữ liệu cần xem. Khóa thủ công hoặc rời màn hình rồi mở lại để xác nhận secret không còn hiển thị.
21. **Cá nhân → Lịch dạy gia sư:** chuyển tuần, xem agenda theo ngày, thêm học viên/buổi học, sửa từ tuần này về sau
    hoặc chỉ đổi một buổi, hủy/khôi phục và xử lý cảnh báo trùng lịch.
22. **Cá nhân → Chỗ ở & Tin trọ:** thêm địa điểm tham chiếu, tạo tin với chi phí và ảnh từ camera/thư viện, tìm kiếm
    danh sách, tính lại khoảng cách, sửa/xóa theo quyền, rồi gửi review OK/Không OK có lý do.
23. **Du lịch → Tài liệu chuyến đi:** mở một kế hoạch đã lưu, thêm PDF/PNG/JPEG từ thiết bị, xem thumbnail ảnh, theo dõi
    dung lượng/tên file và xóa tài liệu với xác nhận.

## Cấu trúc và dữ liệu

- `app/`: năm tab và stack chi tiết; `src/ui.tsx`: thành phần dùng chung, safe area, bàn phím, hộp xác nhận;
  `src/theme.ts`: màu và font.
- `src/credit.tsx`, `bankStats.tsx`, `bankCards.tsx`, `statements.tsx`, `investment.tsx`, `history.tsx`, `health.tsx`,
  `healthApi.ts`, `travel.tsx`, `lodging.tsx`, `lodgingApi.ts`, `profile.tsx`: các nhóm màn.
- `src/data.ts`: dữ liệu và kiểu dùng chung; `src/store.tsx`: cập nhật, xác nhận, chống trùng và lưu máy. Khóa dữ liệu:
  `kira-life-demo-v1`.
- `assets/receipt*.png`: chứng từ demo; SVG tương ứng là nguồn để chỉnh sửa. Inter và Ionicons được đóng gói từ các gói
  cục bộ, không tải font từ Google khi sử dụng app.
- Số dư/hạn mức tín dụng dùng chung được cộng một lần theo ngân hàng. Thống kê đầu tư tách tiền tệ theo tài khoản; số dư
  đầu kỳ mẫu bằng 0, chỉ tính giao dịch đã ghi sổ và hoàn thành.
- Dữ liệu demo tín dụng/báo cáo giữ ngày mẫu để đồng nhất mockup. Investment accounts, transaction history, statistics,
  authentication và AI queue dùng API thật khi `EXPO_PUBLIC_API_URL` được cấu hình.

## Bàn giao và giới hạn kiểm chứng

Xem [bảng ánh xạ màn](SCREEN-MAP.md). Header/điều hướng nằm ngoài nội dung cuộn; nút lưu/xác nhận ở chân màn. Vùng tương
tác chính tối thiểu 44 px. Dark mode, điện thoại dọc; không thêm các lĩnh vực ngoài phạm vi.

Đã kiểm tra kiểu TypeScript bằng `tsc --noEmit`. Không chạy bộ test, production build hoặc mobile lint. Kết quả kiểm tra
trình duyệt được ghi trong `SCREEN-MAP.md`; **chưa kiểm chứng Expo Go trên iPhone/Android thật**, bàn phím native và
safe area thiết bị cần được xác nhận khi quét QR.

Module Du lịch dùng migration `V24__create_travel_module.sql` và API/backend trong package `com.kira.bank.travel`; dữ
liệu kế hoạch được lưu theo user và bảo vệ bằng version conflict.

Investment reconciliation reports dùng `V28__create_investment_reconciliation_reports.sql`; AI job lifecycle dùng
`V30__create_investment_ai_job_events.sql`; health module dùng `V23__create_health_module.sql`; chưa chạy Flyway/runtime
trong phạm vi kiểm tra local. API Admin được bảo vệ bởi role ADMIN và cập nhật trạng thái qua pessimistic lock + version
check.
