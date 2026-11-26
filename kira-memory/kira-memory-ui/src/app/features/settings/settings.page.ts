import {Component, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AdminSettings, Api, errorMessage, StorageProvider, WidgetShape} from '../../core/api';
import {SHAPE_KEYS, shapeAt, SHAPES} from '../../shared/shapes';

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink],
  template: `
    <header>
      <a class="btn ghost" routerLink="/">‹ Về trang ảnh</a>
      <h1 class="script">Cài đặt</h1>
      <a class="btn" routerLink="/tai-khoan">Tài khoản và mật khẩu</a>
    </header>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    @if (s(); as s) {
      <section>
        <h2>Nơi lưu ảnh và video mới</h2>
        <p class="muted">Ảnh đã tải lên vẫn ở chỗ cũ và vẫn xem được; chỉ những lần tải sau mới đi theo lựa chọn này.</p>
        <div class="choices" role="radiogroup" aria-label="Nơi lưu trữ">
          @for (p of providers; track p.key) {
            <button type="button" role="radio" class="choice" [attr.aria-checked]="s.storageProvider === p.key"
                    [disabled]="!configured(s, p.key) || busy()" (click)="save({storageProvider: p.key})">
              <strong>{{ p.label }}</strong>
              <small>{{ configured(s, p.key) ? (s.storageProvider === p.key ? 'Đang dùng' : 'Sẵn sàng') : 'Chưa cấu hình trên server' }}</small>
            </button>
          }
        </div>
      </section>

      <section>
        <h2>Hình dạng hộp lời nhắn</h2>
        <p class="muted">Hai người đều thấy hình này ở góc phải dưới màn hình.</p>
        <div class="shapes" role="radiogroup" aria-label="Hình dạng">
          @for (k of shapeKeys; track k) {
            <button type="button" role="radio" class="shape" [attr.aria-checked]="s.widgetShape === k" [disabled]="busy()"
                    (click)="save({widgetShape: k})">
              <svg viewBox="0 0 64 64" aria-hidden="true"><path [attr.d]="shapes[k].path"/></svg>
              <span>{{ shapes[k].label }}</span>
            </button>
          }
          <button type="button" role="radio" class="shape" [attr.aria-checked]="s.widgetShape === 'auto'" [disabled]="busy()"
                  (click)="save({widgetShape: 'auto'})">
            <svg viewBox="0 0 64 64" aria-hidden="true"><path [attr.d]="shapes[autoPreview()].path"/></svg>
            <span>Tự đổi mỗi phút</span>
          </button>
        </div>
      </section>

      <section>
        <h2>Ảnh ở trang đăng nhập</h2>
        @if (s.bannerMediaId) {
          <p class="muted">Đã chọn một ảnh. Muốn đổi, mở ảnh khác và bấm "Đặt làm ảnh trang đăng nhập".</p>
          <button class="btn" type="button" [disabled]="busy()" (click)="save({clearBanner: true})">Bỏ ảnh, dùng nền mặc định</button>
        } @else {
          <p class="muted">Chưa chọn. Mở một ảnh bất kỳ và bấm "Đặt làm ảnh trang đăng nhập".</p>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; max-width: 760px; margin: 0 auto; padding: 20px 20px 120px; }
    header { display: grid; gap: 4px; justify-items: start; }
    h1 { margin: 0; font-size: 46px; color: var(--rose-deep); }
    section { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--blush); }
    h2 { margin: 0 0 4px; font-size: 18px; }
    section > p { margin: 0 0 14px; }
    .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .choice { display: grid; gap: 2px; text-align: left; padding: 14px 16px; border: 1px solid var(--blush); border-radius: 18px;
      background: var(--paper); cursor: pointer; }
    .choice small { color: var(--mauve); }
    .choice[aria-checked='true'] { border-color: var(--rose); box-shadow: 0 0 0 3px rgb(225 29 72 / .15); }
    .choice:disabled { opacity: .55; cursor: not-allowed; }
    .shapes { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
    .shape { display: grid; justify-items: center; gap: 6px; padding: 12px 6px; border: 1px solid var(--blush); border-radius: 18px;
      background: var(--paper); cursor: pointer; font-size: 13px; }
    .shape svg { width: 44px; height: 44px; }
    .shape path { fill: var(--blush); stroke: var(--rose); stroke-width: 2.5; stroke-linejoin: round; }
    .shape[aria-checked='true'] { border-color: var(--rose); }
    .shape[aria-checked='true'] path { fill: var(--rose); stroke: var(--paper); }
  `
})
export class SettingsPage {
  private api = inject(Api);
  protected s = signal<AdminSettings | null>(null);
  protected busy = signal(false);
  protected error = signal('');
  protected shapes = SHAPES;
  protected shapeKeys = SHAPE_KEYS;
  protected autoPreview = () => shapeAt('auto', Date.now());
  protected providers: {key: StorageProvider; label: string}[] = [
    {key: 'HUGGING_FACE', label: 'Hugging Face'},
    {key: 'R2', label: 'Cloudflare R2'}
  ];

  constructor() {
    this.api.adminSettings().subscribe({next: s => this.s.set(s), error: err => this.error.set(errorMessage(err))});
  }

  protected configured(s: AdminSettings, p: StorageProvider) {
    return p === 'R2' ? s.r2Configured : s.huggingFaceConfigured;
  }

  protected save(patch: Partial<{widgetShape: WidgetShape; storageProvider: StorageProvider; clearBanner: boolean}>) {
    this.busy.set(true);
    this.error.set('');
    this.api.updateSettings(patch).subscribe({
      next: s => {
        this.s.set(s);
        this.busy.set(false);
      },
      error: err => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      }
    });
  }
}
