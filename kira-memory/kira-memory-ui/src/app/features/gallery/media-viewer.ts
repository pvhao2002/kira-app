import {Component, computed, effect, HostListener, inject, input, output, signal, untracked} from '@angular/core';
import {A11yModule} from '@angular/cdk/a11y';
import {FormsModule} from '@angular/forms';
import {Api, errorMessage, Group, Media} from '../../core/api';
import {AuthStore} from '../../core/auth';

/** A finished touch move: 1 (next) for a swipe to the left, -1 (previous) to the right, 0 for taps and scrolls. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

@Component({
  selector: 'app-media-viewer',
  imports: [FormsModule, A11yModule],
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    @if (item(); as m) {
      <section class="viewer" role="dialog" aria-modal="true" aria-label="Xem kỷ niệm" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
        <button class="btn ghost close" type="button" (click)="closed.emit()" aria-label="Đóng">✕</button>
        <figure>
          <div class="stage" (pointerdown)="down($event)" (pointerup)="up($event)" (pointercancel)="cancel()">
            <span class="count">{{ index() + 1 }} / {{ items().length }}{{ more() ? '+' : '' }}</span>
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
              <div class="row">
                <a class="btn" [href]="m.url" [attr.download]="fileName(m)">Tải về</a>
                @if (auth.isAdmin()) {
                  <button class="btn" type="button" (click)="startEdit(m)">Sửa lời nhắn, nhóm</button>
                  @if (m.kind === 'IMAGE') { <button class="btn" type="button" (click)="banner(m)">Đặt làm ảnh trang đăng nhập</button> }
                  <button class="btn danger" type="button" [disabled]="busy()" (click)="remove(m)">Xoá</button>
                }
              </div>
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
    /* Horizontal moves reach the swipe handler; vertical scrolling and pinch zoom stay with the browser. */
    .stage { position: relative; display: grid; place-items: center; background: #2a0a13; min-height: 200px; touch-action: pan-y pinch-zoom; }
    .count { position: absolute; top: 10px; left: 10px; z-index: 1; padding: 2px 10px; border-radius: 999px;
      background: rgb(42 10 19 / .6); color: #fff; font-size: 13px; font-variant-numeric: tabular-nums; }
    .row a { text-decoration: none; }
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
    @media (max-width: 560px) {
      :host { padding: 0; }
      .viewer { width: 100%; height: 100%; border-radius: 0; padding: 0 0 16px; }
      .stage img, .stage video { max-height: 70vh; }
      figcaption { padding: 12px 14px 0; }
    }
  `
})
export class MediaViewer {
  private api = inject(Api);
  protected auth = inject(AuthStore);
  readonly items = input.required<Media[]>();
  readonly index = input.required<number>();
  readonly groups = input.required<Group[]>();
  /** More pages exist beyond the loaded items. */
  readonly more = input(false);
  readonly needMore = output<void>();
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
  private start: {id: number; x: number; y: number} | null = null;
  private touches = 0;

  constructor() {
    effect(() => {
      this.index();
      this.editing.set(false);
      this.error.set('');
      this.notice.set('');
    });
    // The neighbours load while this one is looked at, so the next swipe shows the full photo at once.
    effect(() => {
      const list = this.items();
      const i = this.index();
      for (const n of [list[i + 1], list[i - 1]]) if (n?.kind === 'IMAGE') new Image().src = n.url;
    });
    // Near the end of what is loaded: ask the gallery for the next page.
    effect(() => {
      if (this.more() && this.index() >= this.items().length - 3) untracked(() => this.needMore.emit());
    });
  }

  protected down(e: PointerEvent) {
    // The mouse has the arrow buttons and keys; a video keeps its own controls.
    if (e.pointerType === 'mouse' || (e.target as HTMLElement).tagName === 'VIDEO') return;
    this.touches++;
    // A second finger means pinch zoom, not a swipe.
    this.start = this.touches === 1 ? {id: e.pointerId, x: e.clientX, y: e.clientY} : null;
  }

  protected up(e: PointerEvent) {
    this.touches = Math.max(0, this.touches - 1);
    const s = this.start;
    if (!s || s.id !== e.pointerId || this.editing()) return;
    this.start = null;
    const step = swipeStep(e.clientX - s.x, e.clientY - s.y);
    if (step) this.go(step);
  }

  protected cancel() {
    this.touches = 0;
    this.start = null;
  }

  /** e.g. ky-niem-2026-06-14-42.jpg instead of the stored name o.jpg. */
  protected fileName(m: Media) {
    return `ky-niem-${m.takenAt.slice(0, 10)}-${m.id}.${m.url.slice(m.url.lastIndexOf('.') + 1)}`;
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
