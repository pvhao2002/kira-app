"""Build the local evidence index from the browser capture manifest."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
rows = json.loads((root / '.expo/visual-qa/capture-results.json').read_text(encoding='utf-8'))
items = list({r['name']: r for r in reversed(rows)}.values())
items.reverse()
labels = dict(zip(
    ['dashboard', 'cards', 'benefits', 'profile', 'accounts', 'import', 'queue', 'account-add', 'account-edit', 'source', 'ai-result', 'draft-edit', 'decision', 'result-partial', 'result-success', 'filter', 'history-empty', 'history', 'transaction-detail', 'report-create', 'report-success', 'reports', 'credit-stats', 'account-stats'],
    ['Dashboard tín dụng', 'Thẻ của tôi', 'Ưu đãi và hoàn tiền', 'Cá nhân', 'Tài khoản đầu tư', 'Nhập giao dịch', 'Hàng đợi AI', 'Thêm tài khoản', 'Sửa tài khoản', 'Ảnh chứng từ', 'Kết quả AI', 'Sửa bản ghi', 'Cách xử lý', 'Xác nhận một phần', 'Xác nhận toàn bộ', 'Bộ lọc', 'Lịch sử trống', 'Danh sách lịch sử', 'Chi tiết giao dịch', 'Tạo báo cáo', 'Thông báo gửi thành công', 'Danh sách tra soát', 'Thống kê tín dụng', 'Thống kê tài khoản']))
lines = ['# Kiểm chứng giao diện — 11/09/2026', '', '## Phạm vi và bằng chứng', '',
    '- Đã chụp 24 trạng thái ở chiều rộng ảnh nguồn và 360, 390, 430 px: 96 tổ hợp, mỗi tổ hợp có ảnh đầu/cuối vùng cuộn (192 ảnh).',
    '- Đã đọc cả `screen.png` và `code.html`. Ảnh nguồn của bộ lọc là một phần nội dung; bản chạy giữ toàn bộ nội dung cuộn từ HTML.',
    '- Không có `pageerror` và không tràn ngang toàn trang. Danh sách `clipping` trong JSON ghi các chip ngoài vùng nhìn của thanh cuộn ngang; đã rà và phân biệt với lỗi mất nút.',
    '- Đã sửa qua đối chiếu: số tiền xuống dòng, khoảng cách tiêu đề, header sai nhóm, thiếu mục sao kê, thiếu ảnh/biểu đồ và ảnh chụp trước khi tài nguyên tải xong.',
    '- Kiểm tra kiểu TypeScript qua. Không chạy production build, mobile lint hoặc bộ test.', '',
    '## 24 trạng thái đã rà trên web', '',
    'Bảng ghi nhận phạm vi đã chụp và rà, không phải chứng nhận 24/24 màn pixel-perfect. Các ảnh đầu/cuối bao quát nội dung dài, tab và thanh tác vụ.', '',
    '| Màn | Route | Ảnh ở chiều rộng nguồn |', '|---|---|---|']
for r in items:
    stem = f"{r['name']}-{r['width']}"
    lines.append(f"| {labels[r['name']]} | `{r['route']}` | [Đầu](.expo/visual-qa/{stem}-top.png) · [Cuối](.expo/visual-qa/{stem}-bottom.png) |")
lines += ['', '## Kiểm tra tương tác', '', 'Đã chạy bằng thao tác trên Chrome tại 390 × 844:', '',
    '1. Thêm tài khoản, sửa tên và tải lại — dữ liệu được giữ.',
    '2. Xác nhận lô mặc định — thêm một bản ghi, giữ một bản ghi xung đột.',
    '3. Chọn gộp rồi xác nhận — cập nhật một bản ghi, còn 0 mục chưa xử lý; lịch sử có 4 giao dịch, không cộng trùng.',
    '4. Chọn Nạp tiền + Thưởng và trạng thái Hoàn thành — bộ lọc lưu đúng.',
    '5. Khoảng ngày vượt 90 ngày bị từ chối; đóng sheet không áp dụng không ghi thay đổi nháp.',
    '6. Gửi báo cáo — thêm đúng một báo cáo, giao dịch giữ nguyên và hiện thông báo thành công.',
    '7. Hủy công việc đang chờ — chuyển sang Đã hủy.',
    '8. Thử lại AI thất bại — chuyển sang Sẵn sàng.',
    '9. Nạp dữ liệu bộ lọc cũ thiếu `types`/`status` — giữ tên tài khoản đã lưu, chuyển loại `bonus` thành danh sách và mặc định trạng thái `all`.', '',
    'Kết quả máy đọc: [capture-results.json](.expo/visual-qa/capture-results.json), [flow-results.json](.expo/visual-qa/flow-results.json).', '',
    '## Giới hạn nghiệm thu', '',
    '- Chưa kiểm chứng Expo Go trên iPhone/Android thật, bàn phím native, safe area thiết bị, phóng to chữ hoặc hoạt động sau khi hệ điều hành đóng ứng dụng.',
    '- Chưa chứng nhận giống hệt từng pixel. Thành phần native còn có khác biệt về mật độ bố cục, glyph icon và blur so với HTML/ảnh nguồn. Không dùng việc đủ route và các luồng demo chạy được để thay cho tiêu chí này.',
    '- Mockup có nhiều bộ số liệu khác nhau. Dùng `/demo` để chọn kịch bản tương ứng; không đối chiếu dữ liệu mặc định với mọi ảnh nguồn.',
    '- Thanh toán, liên kết, xuất tài liệu và xác thực chỉ phản hồi mô phỏng; không có API, database hoặc đăng nhập thật.', '']
(root / 'VISUAL-QA.md').write_text('\n'.join(lines), encoding='utf-8')
print(f'Indexed {len(items)} screens')
