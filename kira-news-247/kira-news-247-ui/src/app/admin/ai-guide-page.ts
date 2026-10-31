import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';

export const QUICK_PASTE_TEMPLATE = `---
title: Tiêu đề bài viết (5-300 ký tự, viết hoa chữ cái đầu)
summary: Sapo 1-2 câu, tối đa 1000 ký tự – dùng làm mô tả SEO
category: cong-nghe
tags: AI, Việt Nam
cover: https://images.example.com/anh-bia.jpg
sources:
  - https://nguon-1.example.com/bai-goc
  - https://nguon-2.example.com/bai-goc
---

## Bối cảnh

Đoạn mở đầu…

## Diễn biến chính

- Ý 1
- Ý 2

## Ý nghĩa

Đoạn kết…`;

/** Instructions shown inside the admin so the computer-use agent can re-read them any time. */
@Component({
  selector: 'news-ai-guide-page',
  imports: [RouterLink, HlmButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="font-serif text-2xl font-bold">Hướng dẫn cho AI biên tập</h1>
    <div class="mt-6 grid gap-6 lg:grid-cols-2">
      <section class="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed" data-testid="ai-guide-steps">
        <h2 class="text-lg font-semibold">Quy trình mỗi ngày</h2>
        <ol class="mt-3 list-decimal space-y-2 pl-5">
          <li>Đăng nhập bằng tài khoản AI tại <code>/admin/dang-nhap</code>.</li>
          <li><strong>Xử lý góp ý trước:</strong> mở <a routerLink="/admin/viec-cho-ai" class="text-link underline">Việc cho AI</a> (tab “Cần sửa”). Với từng bài:
            đọc mọi góp ý màu cam → sửa nội dung trong form → bấm <em>Lưu thay đổi</em> → ở mỗi góp ý nhập ngắn gọn đã sửa gì và bấm <em>Đã xử lý</em> → bấm <em>Gửi duyệt</em>.</li>
          <li><strong>Viết bài mới:</strong> mở <a routerLink="/admin/viet-bai" class="text-link underline">Viết bài mới</a>, mở mục “Dán nhanh”, dán một khối theo mẫu bên cạnh,
            bấm <em>Điền vào form</em>, kiểm tra, bấm <em>Tạo bản nháp</em>, rồi bấm <em>Gửi duyệt</em>.</li>
          <li>Chỉ dùng thông tin có nguồn, ghi đủ URL nguồn. Không sao chép nguyên văn; viết lại bằng tiếng Việt chuẩn, trung lập.</li>
          <li>Không tạo trùng chủ đề đã có: dùng ô tìm kiếm ở <a routerLink="/admin/bai-viet" class="text-link underline">Duyệt bài</a> (tab “Tất cả”) trước khi viết.</li>
          <li>AI không thể xuất bản. Bài chỉ lên trang khi quản trị viên bấm <em>Duyệt &amp; xuất bản</em>.</li>
        </ol>
        <h3 class="mt-5 font-semibold">Mã chuyên mục</h3>
        <p class="mt-1">thoi-su, the-gioi, kinh-doanh, cong-nghe, the-thao, giai-tri, suc-khoe, doi-song</p>
        <h3 class="mt-5 font-semibold">Khi gặp lỗi</h3>
        <p class="mt-1">Thông báo lỗi hiện trong khung đỏ phía trên form (data-testid="error"). “Bài viết đã thay đổi…” nghĩa là cần tải lại trang (F5) rồi làm lại thao tác.</p>
      </section>
      <section class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">Mẫu “Dán nhanh”</h2>
          <button hlmBtn variant="outline" size="sm" type="button" data-testid="copy-template" (click)="copy()">{{ copied() ? 'Đã chép' : 'Chép mẫu' }}</button>
        </div>
        <pre class="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs" data-testid="quick-paste-template">{{ template }}</pre>
      </section>
    </div>
  `,
})
export class AiGuidePage {
  protected readonly template = QUICK_PASTE_TEMPLATE;
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.template).catch(() => undefined);
    this.copied.set(true);
  }
}
