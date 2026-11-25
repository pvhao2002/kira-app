import {Component, computed, effect, HostListener, inject, input, output, signal} from '@angular/core';
import {A11yModule} from '@angular/cdk/a11y';
import {FormsModule} from '@angular/forms';
import {Api, errorMessage, Group, Media} from '../../core/api';
import {AuthStore} from '../../core/auth';

@Component({
  selector: 'app-media-viewer',
  imports: [FormsModule, A11yModule],
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    @if (item(); as m) {
      <section class="viewer" role="dialog" aria-modal="true" aria-label="Xem kỷ niệm" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
        <button class="btn ghost close" type="button" (click)="closed.emit()" aria-label="Đóng">✕</button>
        <figure>
          <div class="stage">
            @if (m.kind === 'VIDEO') {
              <video [src]="m.url" [poster]="m.thumbUrl" controls playsinline preload="metadata"></video>
            } @else {
              <img [src]="m.url" [style.background-image]="'url(' + m.thumbUrl + ')'" alt="{{ m.caption || 'Kỷ niệm' }}" decoding="async"
                   [style.aspect-ratio]="m.width && m.height ? m.width + ' / ' + m.height : null">
            }
            @if (index() > 0) { <button class="nav prev" type="button" (click)="go(-1)" aria-label="Ảnh trước">‹</button> }
            @if (index() < items().length - 1) { <button class="nav next" type="button" (click)="go(1)" aria-label="Ảnh sau">›</button> }
          </div>
          <figcaption>
            @if (editing()) {
              <form class="edit" (ngSubmit)="save(m)">
                <label class="field">Lời nhắn / caption
                  <textarea class="input" name="caption" rows="3" maxlength="2000" [(ngModel)]="caption"></textarea>
                </label>
                <label class="field">Nhóm
                  <select class="input" name="group" [(ngModel)]="groupId">
                    <option [ngValue]="null">Không thuộc nhóm nào</option>
                    @for (g of groups(); track g.id) { <option [ngValue]="g.id">{{ g.name }}</option> }
                  </select>
                </label>
                <div class="row">
                  <button class="btn primary" type="submit" [disabled]="busy()">Lưu</button>
                  <button class="btn ghost" type="button" (click)="editing.set(false)">Huỷ</button>
                </div>
              </form>
            } @else {
              @if (m.caption) { <p class="caption script">{{ m.caption }}</p> }
              <p class="muted when">{{ date(m.takenAt) }}</p>
              @if (auth.isAdmin()) {
                <div class="row">
                  <button class="btn" type="button" (click)="startEdit(m)">Sửa lời nhắn, nhóm</button>
                  @if (m.kind === 'IMAGE') { <button class="btn" type="button" (click)="banner(m)">Đặt làm ảnh trang đăng nhập</button> }
                  <button class="btn danger" type="button" (click)="remove(m)">Xoá</button>
                </div>
              }
            }
            @if (notice()) { <p class="muted" role="status">{{ notice() }}</p> }
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          </figcaption>
        </figure>
      </section>
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; }
    .backdrop { position: absolute; inset: 0; background: rgb(60 8 22 / .82); }
    .viewer { position: relative; width: min(1100px, 100%); max-height: 100%; overflow: auto; background: var(--paper);
      border-radius: 4px; padding: 14px 14px 18px; box-shadow: 0 30px 80px -20px rgb(0 0 0 / .5); }
    .close { position: absolute; top: 6px; right: 6px; z-index: 2; width: 40px; padding: 0; background: var(--paper); }
    figure { margin: 0; }
    .stage { position: relative; display: grid; place-items: center; background: #2a0a13; min-height: 200px; }
    .stage img, .stage video { max-height: 72vh; width: auto; max-width: 100%; }
    /* The cached thumbnail shows, blurred by scaling, until the original arrives. */
    .stage img { background: center / cover no-repeat; }
    .nav { position: absolute; top: 50%; translate: 0 -50%; width: 44px; height: 44px; border: 0; border-radius: 50%;
      background: rgb(255 253 253 / .85); color: var(--wine); font-size: 28px; line-height: 1; cursor: pointer; }
    .prev { left: 10px; } .next { right: 10px; }
    figcaption { padding: 14px 6px 0; max-width: 72ch; }
    .caption { margin: 0; font-size: 28px; line-height: 1.3; white-space: pre-wrap; overflow-wrap: anywhere; }
    .when { margin: 4px 0 12px; font-size: 14px; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .edit { display: grid; gap: 12px; }
  `
})
export class MediaViewer {
  private api = inject(Api);
  protected auth = inject(AuthStore);
  readonly items = input.required<Media[]>();
  readonly index = input.required<number>();
  readonly groups = input.required<Group[]>();
  readonly indexChange = output<number>();
  readonly closed = output<void>();
  readonly changed = output<Media>();
  readonly deleted = output<number>();

  protected item = computed(() => this.items()[this.index()] ?? null);
  protected editing = signal(false);
  protected busy = signal(false);
  protected error = signal('');
  protected notice = signal('');
  protected caption = '';
  protected groupId: number | null = null;

  constructor() {
    effect(() => {
      this.index();
      this.editing.set(false);
      this.error.set('');
      this.notice.set('');
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected key(e: KeyboardEvent) {
    if (this.editing()) return;
    if (e.key === 'Escape') this.closed.emit();
    if (e.key === 'ArrowLeft') this.go(-1);
    if (e.key === 'ArrowRight') this.go(1);
  }

  protected go(step: number) {
    const next = this.index() + step;
    if (next >= 0 && next < this.items().length) this.indexChange.emit(next);
  }

  protected startEdit(m: Media) {
    this.caption = m.caption ?? '';
    this.groupId = m.groupId;
    this.editing.set(true);
  }

  protected save(m: Media) {
    this.busy.set(true);
    this.api.updateMedia(m.id, this.caption.trim() || null, this.groupId).subscribe({
      next: updated => {
        this.busy.set(false);
        this.editing.set(false);
        this.changed.emit(updated);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      }
    });
  }

  protected banner(m: Media) {
    this.api.updateSettings({bannerMediaId: m.id}).subscribe({
      next: () => this.notice.set('Đã đặt làm ảnh trang đăng nhập'),
      error: err => this.error.set(errorMessage(err))
    });
  }

  protected remove(m: Media) {
    if (!confirm('Xoá kỷ niệm này? Ảnh hoặc video sẽ bị xoá khỏi nơi lưu trữ và không khôi phục được.')) return;
    this.busy.set(true);
    this.api.deleteMedia(m.id).subscribe({
      next: () => this.deleted.emit(m.id),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      }
    });
  }

  protected date(iso: string) {
    return new Date(iso).toLocaleDateString('vi-VN', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh'});
  }
}
