# Kiểm chứng giao diện — 11/09/2026

## Phạm vi và bằng chứng

- Đã chụp 24 trạng thái ở chiều rộng ảnh nguồn và 360, 390, 430 px: 96 tổ hợp, mỗi tổ hợp có ảnh đầu/cuối vùng cuộn (192
  ảnh).
- Đã đọc cả `screen.png` và `code.html`. Ảnh nguồn của bộ lọc là một phần nội dung; bản chạy giữ toàn bộ nội dung cuộn
  từ HTML.
- Không có `pageerror` và không tràn ngang toàn trang. Danh sách `clipping` trong JSON ghi các chip ngoài vùng nhìn của
  thanh cuộn ngang; đã rà và phân biệt với lỗi mất nút.
- Đã sửa qua đối chiếu: số tiền xuống dòng, khoảng cách tiêu đề, header sai nhóm, thiếu mục sao kê, thiếu ảnh/biểu đồ và
  ảnh chụp trước khi tài nguyên tải xong.
- Kiểm tra kiểu TypeScript qua. Không chạy production build, mobile lint hoặc bộ test.

## 24 trạng thái đã rà trên web

Bảng ghi nhận phạm vi đã chụp và rà, không phải chứng nhận 24/24 màn pixel-perfect. Các ảnh đầu/cuối bao quát nội dung
dài, tab và thanh tác vụ.

| Màn                      | Route                                 | Ảnh ở chiều rộng nguồn                                                                                            |
|--------------------------|---------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Dashboard tín dụng       | `/`                                   | [Đầu](.expo/visual-qa/dashboard-351-top.png) · [Cuối](.expo/visual-qa/dashboard-351-bottom.png)                   |
| Thẻ của tôi              | `/cards`                              | [Đầu](.expo/visual-qa/cards-310-top.png) · [Cuối](.expo/visual-qa/cards-310-bottom.png)                           |
| Ưu đãi và hoàn tiền      | `/benefits`                           | [Đầu](.expo/visual-qa/benefits-428-top.png) · [Cuối](.expo/visual-qa/benefits-428-bottom.png)                     |
| Cá nhân                  | `/profile`                            | [Đầu](.expo/visual-qa/profile-511-top.png) · [Cuối](.expo/visual-qa/profile-511-bottom.png)                       |
| Tài khoản đầu tư         | `/investment`                         | [Đầu](.expo/visual-qa/accounts-472-top.png) · [Cuối](.expo/visual-qa/accounts-472-bottom.png)                     |
| Nhập giao dịch           | `/import`                             | [Đầu](.expo/visual-qa/import-379-top.png) · [Cuối](.expo/visual-qa/import-379-bottom.png)                         |
| Hàng đợi AI              | `/queue`                              | [Đầu](.expo/visual-qa/queue-445-top.png) · [Cuối](.expo/visual-qa/queue-445-bottom.png)                           |
| Thêm tài khoản           | `/account-add`                        | [Đầu](.expo/visual-qa/account-add-443-top.png) · [Cuối](.expo/visual-qa/account-add-443-bottom.png)               |
| Sửa tài khoản            | `/account-edit?id=ssi`                | [Đầu](.expo/visual-qa/account-edit-402-top.png) · [Cuối](.expo/visual-qa/account-edit-402-bottom.png)             |
| Ảnh chứng từ             | `/source?id=job-1`                    | [Đầu](.expo/visual-qa/source-595-top.png) · [Cuối](.expo/visual-qa/source-595-bottom.png)                         |
| Kết quả AI               | `/ai-result?id=job-1`                 | [Đầu](.expo/visual-qa/ai-result-447-top.png) · [Cuối](.expo/visual-qa/ai-result-447-bottom.png)                   |
| Sửa bản ghi              | `/draft-edit?id=draft-2`              | [Đầu](.expo/visual-qa/draft-edit-466-top.png) · [Cuối](.expo/visual-qa/draft-edit-466-bottom.png)                 |
| Cách xử lý               | `/decision?id=draft-2`                | [Đầu](.expo/visual-qa/decision-514-top.png) · [Cuối](.expo/visual-qa/decision-514-bottom.png)                     |
| Xác nhận một phần        | `/result-partial`                     | [Đầu](.expo/visual-qa/result-partial-469-top.png) · [Cuối](.expo/visual-qa/result-partial-469-bottom.png)         |
| Xác nhận toàn bộ         | `/result-success`                     | [Đầu](.expo/visual-qa/result-success-499-top.png) · [Cuối](.expo/visual-qa/result-success-499-bottom.png)         |
| Bộ lọc                   | `/filter`                             | [Đầu](.expo/visual-qa/filter-585-top.png) · [Cuối](.expo/visual-qa/filter-585-bottom.png)                         |
| Lịch sử trống            | `/history`                            | [Đầu](.expo/visual-qa/history-empty-630-top.png) · [Cuối](.expo/visual-qa/history-empty-630-bottom.png)           |
| Danh sách lịch sử        | `/history`                            | [Đầu](.expo/visual-qa/history-459-top.png) · [Cuối](.expo/visual-qa/history-459-bottom.png)                       |
| Chi tiết giao dịch       | `/transaction-detail?id=tx-reference` | [Đầu](.expo/visual-qa/transaction-detail-462-top.png) · [Cuối](.expo/visual-qa/transaction-detail-462-bottom.png) |
| Tạo báo cáo              | `/report-create?id=tx-reference`      | [Đầu](.expo/visual-qa/report-create-401-top.png) · [Cuối](.expo/visual-qa/report-create-401-bottom.png)           |
| Thông báo gửi thành công | `/report-success?id=tx-reference`     | [Đầu](.expo/visual-qa/report-success-455-top.png) · [Cuối](.expo/visual-qa/report-success-455-bottom.png)         |
| Danh sách tra soát       | `/reports`                            | [Đầu](.expo/visual-qa/reports-375-top.png) · [Cuối](.expo/visual-qa/reports-375-bottom.png)                       |
| Thống kê tín dụng        | `/credit-stats`                       | [Đầu](.expo/visual-qa/credit-stats-340-top.png) · [Cuối](.expo/visual-qa/credit-stats-340-bottom.png)             |
| Thống kê tài khoản       | `/account-stats?id=ssi`               | [Đầu](.expo/visual-qa/account-stats-335-top.png) · [Cuối](.expo/visual-qa/account-stats-335-bottom.png)           |

## Kiểm tra tương tác

Đã chạy bằng thao tác trên Chrome tại 390 × 844:

1. Thêm tài khoản, sửa tên và tải lại — dữ liệu được giữ.
2. Xác nhận lô mặc định — thêm một bản ghi, giữ một bản ghi xung đột.
3. Chọn gộp rồi xác nhận — cập nhật một bản ghi, còn 0 mục chưa xử lý; lịch sử có 4 giao dịch, không cộng trùng.
4. Chọn Nạp tiền + Thưởng và trạng thái Hoàn thành — bộ lọc lưu đúng.
5. Khoảng ngày vượt 90 ngày bị từ chối; đóng sheet không áp dụng không ghi thay đổi nháp.
6. Gửi báo cáo — thêm đúng một báo cáo, giao dịch giữ nguyên và hiện thông báo thành công.
7. Hủy công việc đang chờ — chuyển sang Đã hủy.
8. Thử lại AI thất bại — chuyển sang Sẵn sàng.
9. Nạp dữ liệu bộ lọc cũ thiếu `types`/`status` — giữ tên tài khoản đã lưu, chuyển loại `bonus` thành danh sách và mặc
   định trạng thái `all`.

Kết quả máy
đọc: [capture-results.json](.expo/visual-qa/capture-results.json), [flow-results.json](.expo/visual-qa/flow-results.json).

## Giới hạn nghiệm thu

- Chưa kiểm chứng Expo Go trên iPhone/Android thật, bàn phím native, safe area thiết bị, phóng to chữ hoặc hoạt động sau
  khi hệ điều hành đóng ứng dụng.
- Chưa chứng nhận giống hệt từng pixel. Thành phần native còn có khác biệt về mật độ bố cục, glyph icon và blur so với
  HTML/ảnh nguồn. Không dùng việc đủ route và các luồng demo chạy được để thay cho tiêu chí này.
- Mockup có nhiều bộ số liệu khác nhau. Dùng `/demo` để chọn kịch bản tương ứng; không đối chiếu dữ liệu mặc định với
  mọi ảnh nguồn.
- Thanh toán, liên kết, xuất tài liệu và xác thực chỉ phản hồi mô phỏng; không có API, database hoặc đăng nhập thật.
