# Kira Life Mobile · Glacier

Ứng dụng demo React Native / TypeScript, Expo SDK 54 và Expo Router. Dùng thành phần native, ba tab **Thẻ tín dụng · Đầu tư · Cá nhân**, các màn chi tiết và một bộ lọc bottom sheet. Nguồn tham chiếu: `../docs/mobile/Design UI UX`, gồm ảnh, nội dung HTML và `glacier/DESIGN.md`.

## Cài đặt và mở bằng Expo Go

```powershell
cd D:\kira\kira-app\kira-bank\kira-life-mobile
npm ci
npm start
```

Máy tính và điện thoại dùng cùng mạng Wi-Fi. Mở Expo Go trên Android hoặc dùng Camera iPhone quét QR trong terminal rồi chọn mở bằng Expo Go. Cho phép kết nối mạng nội bộ khi thiết bị hỏi. Giữ terminal đang chạy; nhấn Ctrl+C để dừng. Nếu máy có tường lửa, cho phép Node trên mạng riêng.

Ứng dụng cố định SDK 54 theo phạm vi đã chốt. Expo Go cài trên thiết bị phải hỗ trợ SDK này; phiên bản trên App Store có thể thay đổi theo thời gian. Khi gặp thông báo không tương thích, đối chiếu [hướng dẫn Expo](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) trước khi nâng SDK. Không cài thư viện native tùy ý ngoài Expo Go.

Xem trước trên trình duyệt: `npm run web`. Đây là bản render React Native Web, không thay thế kiểm tra Expo Go trên điện thoại.

## Đối chiếu mockup (bản cập nhật giao diện)

24 màn tiếp tục dùng các route trong `SCREEN-MAP.md`. Header Kira Bank, tab dưới, thẻ kính, ảnh minh họa gốc, biểu đồ SVG native và các bảng sửa/tra soát đã được bổ sung. Hai bộ lọc nâng cao/toàn trang không nằm trong phạm vi.

Mở `/demo` trên Expo Web để chọn dữ liệu kiểm tra. Công cụ này đã tách khỏi màn Cá nhân. Các kịch bản `Mockup` cung cấp dữ liệu lịch sử, kết quả xác nhận và thống kê riêng; chúng không phải số dư ngân hàng thật. Chọn kịch bản cần xác nhận vì sẽ thay dữ liệu demo hiện tại.

- `assets/reference/`: 11 ảnh minh họa lấy từ từng thẻ/ảnh trong HTML mẫu; `sources.json` ghi nguồn. Không sử dụng ảnh chụp nguyên màn làm giao diện.
- `src/charts.tsx`: biểu đồ native bằng `react-native-svg`, tương thích Expo SDK 54.
- Bộ lọc hỗ trợ nhiều loại giao dịch, trạng thái, khoảng tiền và tối đa 90 ngày (bao gồm cả hai đầu). Các mốc nhanh dùng ngày demo 18/10/2024.
- Khóa AsyncStorage vẫn là `kira-life-demo-v1`; bộ lọc cũ được nâng sang danh sách loại khi nạp. Điều chỉnh hạn mức/số dư và lịch sử lý do lưu trong `creditConfig` tại thiết bị.
- Các thao tác cần backend như thanh toán, xuất sao kê và xác thực chỉ hiển thị phản hồi mô phỏng khi bấm.

## Thử các luồng

1. **Đầu tư → Nhập giao dịch:** ban đầu có hai bản nháp. Xác nhận sẽ lưu khoản nạp 50 triệu và giữ lại khoản thưởng có khả năng trùng. Mở chỉnh sửa khoản thưởng → Cách xử lý → Gộp với bản ghi có sẵn → Áp dụng → quay về duyệt và xác nhận. Khoản thưởng không bị cộng hai lần. Bản ghi chỉ xuất hiện trong lịch sử sau khi xác nhận; mục bỏ qua không vào lịch sử.
2. **Hàng đợi AI:** thử chạy mục đang chờ, hoàn tất mục đang xử lý, thử lại mục thất bại. Chỉ mục đang chờ có thể hủy. Sau khi bấm chạy, bộ đếm mô phỏng tiếp tục nếu chuyển sang màn khác trong cùng phiên ứng dụng. Đây là tiến trình điều khiển bằng nút để dễ kiểm tra trạng thái.
3. **Nhập chứng từ mẫu:** xử lý hết lô hiện tại, chọn tài khoản hoạt động rồi tạo lô mới. Mở hàng đợi, chạy công việc, xem ảnh/kết quả rồi duyệt. Ảnh mẫu VND/USD được đóng gói trong app, không cần quyền thư viện ảnh. Lô ban đầu có hai giao dịch; các lô bổ sung có một giao dịch mẫu.
4. **Lịch sử → Bộ lọc:** chọn tài khoản, loại, ngày và khoảng tiền, áp dụng; tìm một chuỗi không tồn tại để xem trạng thái trống. Đóng bộ lọc khi chưa áp dụng sẽ bỏ thay đổi. Ngày dùng `YYYY-MM-DD`, số tiền nhập bằng chữ số không có dấu phân nhóm. Có thể chọn đồng thời Nạp tiền và Thưởng; đóng bộ lọc bỏ thay đổi chưa áp dụng.
5. **Chi tiết → Báo cáo sai lệch:** nhập ít nhất 10 ký tự, gửi rồi mở danh sách báo cáo. Giao dịch gốc giữ nguyên.
6. **Tài khoản → Thêm / Chỉnh sửa:** sửa tên, trạng thái, thông tin mẫu; lưu để thấy cập nhật ngay. Tiền tệ cố định sau khi tạo. Không nhập mật khẩu hoặc thông tin đăng nhập thật.
7. **Route `/demo`:** chọn kịch bản mặc định, thành công toàn bộ, lịch sử trống, AI chờ/đang xử lý/thất bại. Có xác nhận trước khi thay thế dữ liệu. Mục **Đặt lại dữ liệu mẫu** khôi phục dữ liệu ban đầu.
8. Đóng/mở lại app để kiểm tra tài khoản, bản nháp, giao dịch, báo cáo và bộ lọc được giữ bằng AsyncStorage. Công tắc thông báo chỉ minh họa giao diện trong phiên.

## Cấu trúc và dữ liệu

- `app/`: ba tab và stack chi tiết; `src/ui.tsx`: thành phần dùng chung, safe area, bàn phím, hộp xác nhận; `src/theme.ts`: màu và font.
- `src/credit.tsx`, `investment.tsx`, `history.tsx`, `profile.tsx`: các nhóm màn.
- `src/data.ts`: dữ liệu và kiểu dùng chung; `src/store.tsx`: cập nhật, xác nhận, chống trùng và lưu máy. Khóa dữ liệu: `kira-life-demo-v1`.
- `assets/receipt*.png`: chứng từ demo; SVG tương ứng là nguồn để chỉnh sửa. Inter và Ionicons được đóng gói từ các gói cục bộ, không tải font từ Google khi sử dụng app.
- Số dư/hạn mức tín dụng dùng chung được cộng một lần theo ngân hàng. Thống kê đầu tư tách tiền tệ theo tài khoản; số dư đầu kỳ mẫu bằng 0, chỉ tính giao dịch đã ghi sổ và hoàn thành.
- Dữ liệu nền cố định quanh ngày 20/10/2024 để đồng nhất mockup; ngày gửi báo cáo dùng ngày hiện tại. Không có API tài chính, đăng nhập thật hoặc kết nối backend.

## Bàn giao và giới hạn kiểm chứng

Xem [bảng ánh xạ 24 màn](SCREEN-MAP.md). Header/điều hướng nằm ngoài nội dung cuộn; nút lưu/xác nhận ở chân màn. Vùng tương tác chính tối thiểu 44 px. Dark mode, điện thoại dọc; không thêm các lĩnh vực ngoài phạm vi.

Đã kiểm tra kiểu TypeScript bằng `tsc --noEmit`. Không chạy bộ test, production build hoặc mobile lint. Kết quả kiểm tra trình duyệt được ghi trong `SCREEN-MAP.md`; **chưa kiểm chứng Expo Go trên iPhone/Android thật**, bàn phím native và safe area thiết bị cần được xác nhận khi quét QR.

Không thay đổi `mobile-app`, ứng dụng iOS, backend, API, cơ sở dữ liệu hoặc mockup nguồn.
