import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {Api, ApiError} from '../../core/api';
import {ImageSlot} from '../../shared/image-slot';
import {Stars} from '../../shared/stars';
import {MyReviewDto, Page, PendingReviewDto, REVIEW_LABELS, errMsg, fmtDate} from './account.data';

interface Draft {
  rating: number;
  text: string;
  /** https:// link; the backend awards +50 instead of +20 when present */
  photoUrl: string;
  sending: boolean;
  error: string;
}

const key = (r: PendingReviewDto): string => `${r.orderId}-${r.productId}`;
const blank = (): Draft => ({rating: 0, text: '', photoUrl: '', sending: false, error: ''});

@Component({
  selector: 'app-reviews-page',
  imports: [ImageSlot, Stars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="page-title">Đánh giá của tôi</h1>
    <div class="row wrap tabs">
      <button type="button" class="tab-pill" [class.on]="tab() === 0" (click)="tab.set(0)">Chờ đánh giá <span class="n">{{ pending().length }}</span></button>
      <button type="button" class="tab-pill" [class.on]="tab() === 1" (click)="tab.set(1)">Đã đánh giá <span class="n">{{ doneTotal() }}</span></button>
    </div>
    @if (error()) {
      <div class="state-box" role="alert"><b>Không tải được dữ liệu</b>{{ error() }} <button type="button" class="btn sm" (click)="load()">Thử lại</button></div>
    }

    @if (tab() === 0) {
      <div class="banner"><b>+50 điểm</b> cho mỗi đánh giá có ảnh, +20 điểm cho đánh giá chỉ có chữ.</div>
      @if (earned() > 0) { <div class="banner ok" role="status">Cảm ơn bạn! Đã cộng {{ earned() }} điểm vào tài khoản.</div> }
      @if (loading()) { <div class="state-box">Đang tải…</div> }
      @for (r of pending(); track keyOf(r)) {
        @if (drafts()[keyOf(r)]; as d) {
          <article class="card rv">
            <app-image-slot class="ph" caption="Ảnh" [radius]="12" ratio="1 / 1" />
            <div class="body">
              <div class="row top">
                <div><div class="nm">{{ r.productName }}</div><div class="muted">Đơn {{ r.orderCode }} · Giao ngày {{ date(r.deliveredAt) }}</div></div>
              </div>
              <div class="row picker" role="radiogroup" aria-label="Chấm điểm">
                @for (n of five; track n) {
                  <button type="button" class="star" [class.on]="n <= d.rating" role="radio" [attr.aria-checked]="n === d.rating" [attr.aria-label]="n + ' sao'" (click)="patch(r, {rating: n})">★</button>
                }
                <span class="muted">{{ labels[d.rating] }}</span>
              </div>
              <textarea class="input" rows="3" placeholder="Chia sẻ cảm nhận về độ tươi, đóng gói, giao hàng…" aria-label="Nội dung đánh giá" maxlength="2000"
                        [value]="d.text" (input)="patch(r, {text: $any($event.target).value})"></textarea>
              <input class="input" type="url" placeholder="Liên kết ảnh (https://…) để nhận +50 điểm" aria-label="Liên kết ảnh"
                     [value]="d.photoUrl" (input)="patch(r, {photoUrl: $any($event.target).value})">
              @if (d.error) { <div class="err" role="alert">{{ d.error }}</div> }
              <div class="row wrap foot">
                <span class="spacer"></span>
                <button type="button" class="btn" [disabled]="!d.rating || d.sending" (click)="submit(r)">{{ d.sending ? 'Đang gửi…' : 'Gửi đánh giá' }}</button>
              </div>
            </div>
          </article>
        }
      }
      @if (!pending().length && !loading() && !error()) {
        <div class="state-box"><b>Bạn đã đánh giá hết</b>Sản phẩm đã giao sẽ hiện ở đây để bạn đánh giá.</div>
      }
    } @else {
      @for (r of done(); track r.id) {
        <article class="card rv">
          <app-image-slot class="ph" caption="Ảnh" [radius]="12" ratio="1 / 1" />
          <div class="body">
            <div class="row"><b>{{ r.productName }}</b><span class="spacer"></span><span class="muted">{{ date(r.createdAt) }}</span></div>
            <app-stars [value]="r.rating" />
            @if (r.body) { <div>{{ r.body }}</div> }
            @if (r.reply) { <div class="reply"><b>Cửa hàng</b> phản hồi: {{ r.reply.body }}</div> }
            <div class="muted">Đã nhận +{{ r.pointsAwarded }} điểm</div>
          </div>
        </article>
      } @empty {
        <div class="state-box">{{ loading() ? 'Đang tải…' : 'Bạn chưa có đánh giá nào.' }}</div>
      }
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .tabs { margin: 20px 0; }
    .banner { background: var(--tint); color: var(--primary); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; }
    .banner.ok { background: var(--accent); color: var(--brown-dark); }
    .err { color: var(--danger); font-size: 13px; }
    .rv { display: flex; gap: 18px; margin-bottom: 16px; }
    .ph { width: 88px; flex: none; align-self: flex-start; }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
    .nm { font-weight: 600; }
    .picker { gap: 4px; }
    .star { border: 0; background: none; padding: 0 2px; font-size: 28px; line-height: 1; color: var(--line); }
    .star.on { color: var(--star); }
    .picker .muted { margin-left: 10px; }
    textarea.input { resize: vertical; }
    .reply { background: var(--surface-2); border-radius: 12px; padding: 10px 14px; font-size: 13px; }
    @media (max-width: 767px) { .rv { flex-direction: column; } .ph { width: 64px; } .foot .btn:last-child { width: 100%; } }
  `
})
export class ReviewsPage {
  private readonly api = inject(Api);
  protected readonly labels = REVIEW_LABELS;
  protected readonly five = [1, 2, 3, 4, 5];
  protected readonly date = fmtDate;
  protected readonly keyOf = key;
  protected readonly tab = signal(0);
  protected readonly pending = signal<PendingReviewDto[]>([]);
  protected readonly done = signal<MyReviewDto[]>([]);
  protected readonly doneTotal = signal(0);
  protected readonly drafts = signal<Record<string, Draft>>({});
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  /** points awarded by the API for reviews sent in this visit */
  protected readonly earned = signal(0);

  protected readonly hasDone = computed(() => this.done().length > 0);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [p, m] = await Promise.all([
        this.api.get<PendingReviewDto[]>('/reviews/pending'),
        this.api.get<Page<MyReviewDto>>('/reviews/mine', {page: 0, size: 50})
      ]);
      this.pending.set(p);
      this.done.set(m.data);
      this.doneTotal.set(m.meta.totalElements);
      this.drafts.update(d => Object.fromEntries(p.map(r => [key(r), d[key(r)] ?? blank()])));
    } catch (e) {
      this.error.set(errMsg(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected patch(r: PendingReviewDto, p: Partial<Draft>): void {
    this.drafts.update(all => ({...all, [key(r)]: {...all[key(r)], ...p}}));
  }

  protected async submit(r: PendingReviewDto): Promise<void> {
    const d = this.drafts()[key(r)];
    if (!d?.rating || d.sending) return;
    this.patch(r, {sending: true, error: ''});
    try {
      const res = await this.api.post<MyReviewDto>('/reviews', {
        orderId: r.orderId, productId: r.productId, rating: d.rating,
        body: d.text.trim() || null, photoUrl: d.photoUrl.trim() || null
      });
      this.earned.update(n => n + res.pointsAwarded);
      this.pending.update(l => l.filter(x => key(x) !== key(r)));
      this.done.update(l => [res, ...l]);
      this.doneTotal.update(n => n + 1);
    } catch (e) {
      const err = e as ApiError;
      this.patch(r, {sending: false, error: err.fieldErrors?.['photoUrl'] ?? errMsg(e)});
    }
  }
}
