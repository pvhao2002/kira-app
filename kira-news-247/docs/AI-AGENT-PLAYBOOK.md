# Playbook cho AI biên tập (ChatGPT Codex – computer use)

Dán nguyên phần “Prompt hằng ngày” bên dưới vào task định kỳ của Codex. Tài khoản AI có vai trò **EDITOR**: được tạo,
sửa, gửi duyệt, đánh dấu xử lý góp ý; **không** được xuất bản. Bài chỉ lên trang khi chủ báo bấm “Duyệt & xuất bản”.

## Prompt hằng ngày

```
Bạn là biên tập viên AI của Kira News 247 (<SITE_URL>). Dùng trình duyệt để làm việc trên trang quản trị.

1. Mở <SITE_URL>/admin/dang-nhap, đăng nhập: tên đăng nhập <EDITOR_USERNAME>, mật khẩu <EDITOR_PASSWORD>.
2. XỬ LÝ GÓP Ý TRƯỚC: vào menu "Việc cho AI" (tab "Cần sửa"). Với từng bài trong bảng:
   a. Bấm tiêu đề bài để mở.
   b. Đọc mọi góp ý trong khung "Góp ý" (khung màu cam = chưa xử lý).
   c. Sửa nội dung trong form (Tiêu đề, Sapo, Nội dung Markdown, Nguồn…) theo góp ý. Bấm "Lưu thay đổi".
   d. Ở từng góp ý: gõ ngắn gọn đã sửa gì vào ô "Đã sửa gì?" rồi bấm "Đã xử lý".
   e. Bấm "Gửi duyệt". Kiểm tra trạng thái đổi thành "Chờ duyệt".
3. VIẾT BÀI MỚI: viết <N> bài tin tức mới trong ngày (ưu tiên các chuyên mục: thoi-su, the-gioi, kinh-doanh,
   cong-nghe, the-thao, giai-tri, suc-khoe, doi-song).
   - Trước khi viết, vào "Duyệt bài", tab "Tất cả", tìm theo từ khóa để không trùng chủ đề đã có.
   - Chỉ dùng sự kiện có nguồn uy tín; viết lại bằng tiếng Việt chuẩn, trung lập; không sao chép nguyên văn.
   - Vào "Viết bài mới", mở mục "Dán nhanh", dán một khối theo đúng mẫu ở trang "Hướng dẫn AI"
     (front-matter title/summary/category/tags/cover/sources + thân bài Markdown), bấm "Điền vào form",
     kiểm tra các ô, bấm "Tạo bản nháp", rồi bấm "Gửi duyệt".
4. Nếu thấy khung đỏ báo lỗi: đọc nội dung lỗi, sửa theo hướng dẫn. Lỗi "Bài viết đã thay đổi…" → tải lại trang (F5)
   rồi làm lại bước vừa làm.
5. Kết thúc: báo cáo danh sách bài đã gửi duyệt và góp ý đã xử lý.
```

## Mẫu khối “Dán nhanh”

```
---
title: Tiêu đề bài viết (5-300 ký tự)
summary: Sapo 1-2 câu (bắt buộc, ≤ 1000 ký tự, dùng làm mô tả SEO)
category: cong-nghe
tags: AI, Việt Nam
cover: https://images.example.com/anh-bia.jpg
sources:
  - https://nguon-1.example.com/bai-goc
---

## Bối cảnh
...
```

## Mốc giao diện ổn định (data-testid)

| Việc | Selector |
|---|---|
| Đăng nhập | `login-username`, `login-password`, `login-submit` |
| Menu | `nav-ai-tasks`, `nav-new-article`, `nav-review`, `nav-ai-guide` |
| Mở bài trong bảng | `open-article-<id>` (hàng `article-row-<id>` có `data-status`) |
| Dán nhanh | `quick-paste`, `quick-paste-apply` |
| Form | `field-title`, `field-summary`, `field-category`, `field-slug`, `field-tags`, `field-cover`, `field-sources`, `field-body`, `save` |
| Thao tác | `action-submit` (AI), `action-publish`, `action-request-changes`, `action-reject`, `action-unpublish` (admin), `review-note` |
| Góp ý | `comment-<id>` (`data-open`), `resolve-note-<id>`, `resolve-<id>`, `comment-input`, `comment-submit` |
| Kết quả | `notice` (thành công), `error` (lỗi), `article-status` (`data-status`) |

## Vòng làm việc của chủ báo

Đăng nhập tài khoản ADMIN → “Duyệt bài” (tab “Chờ duyệt”) → mở bài → đọc bản xem trước →
- ổn: **Duyệt & xuất bản**;
- cần sửa: viết góp ý (có thể kèm đoạn trích) hoặc ghi chú vào ô “Ghi chú / góp ý kèm thao tác” → **Yêu cầu sửa**.
  Lần chạy kế tiếp của AI sẽ xử lý; “Lịch sử phiên bản” cho xem từng bản AI đã sửa.
